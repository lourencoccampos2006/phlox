-- sprint55_prescriptions.sql
-- Phlox — Prescrição estruturada com workflow draft→signed→dispensed→cancelled.
-- 2026-06-02.
--
-- A "prescrição" é o ato (com data, prescritor, justificação). Cada
-- prescrição tem N "items" (medicamentos com posologia estruturada).

create table if not exists prescriptions (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references organizations(id) on delete cascade,
  patient_id        uuid references patients(id) on delete cascade,
  -- Suporta também perfis familiares e o próprio utilizador (uso pessoal/cuidador)
  family_profile_id uuid references family_profiles(id) on delete cascade,
  for_user_id       uuid references auth.users(id),
  episode_id        uuid references episodes(id) on delete set null,
  prescriber_id     uuid not null references auth.users(id),
  prescriber_name   text,                              -- snapshot
  prescriber_license text,                             -- cédula profissional
  prescription_no   text,                              -- nº PEM (SPMS) quando aplicável
  issued_at         timestamptz not null default now(),
  status            text not null default 'draft' check (status in ('draft','signed','dispensed','cancelled','expired')),
  signed_at         timestamptz,
  signed_method     text check (signed_method in ('cmd','smart_card','token','manual','pem')),
  signature_payload jsonb,                             -- hash + serial CMD
  expires_at        date,                              -- típico 30 dias após assinatura
  validity_days     int default 30,
  diagnosis_codes   text[],                            -- ICD-10
  diagnosis_text    text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists prescriptions_patient_idx on prescriptions(patient_id, issued_at desc);
create index if not exists prescriptions_for_user_idx on prescriptions(for_user_id, issued_at desc);
create index if not exists prescriptions_org_status_idx on prescriptions(org_id, status, issued_at desc);
create index if not exists prescriptions_pem_idx on prescriptions(prescription_no) where prescription_no is not null;

-- ─── Items ──────────────────────────────────────────────────────────────────
create table if not exists prescription_items (
  id                uuid primary key default gen_random_uuid(),
  prescription_id   uuid not null references prescriptions(id) on delete cascade,
  -- Identificação do fármaco
  dci               text not null,                    -- DCI normalizada
  brand_name        text,
  dose_text         text,                              -- "20 mg" snapshot
  pack_size         text,                              -- "30 comprimidos"
  ean_code          text,                              -- código de barras do produto
  -- Posologia estruturada (igual ao formato em patient_meds.posology_json)
  posology_json     jsonb not null,
  -- Substituição / regime
  generic_allowed   boolean not null default true,
  rationale         text,                              -- justificação clínica
  prescription_type text check (prescription_type in ('mnsrm','msrm','msrm_e','msrm_r','pos','manipulado')),
  reimbursement     text,                              -- regime de comparticipação
  -- Estado do item (pode ser parcialmente dispensado)
  status            text not null default 'active' check (status in ('active','dispensed','partial','cancelled')),
  dispensed_at      timestamptz,
  dispensed_by      uuid references auth.users(id),
  pharmacy_org_id   uuid references organizations(id),
  qty_dispensed     int,
  created_at        timestamptz not null default now()
);
create index if not exists rx_items_rx_idx on prescription_items(prescription_id);
create index if not exists rx_items_dci_idx on prescription_items(lower(dci));

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table prescriptions enable row level security;
alter table prescription_items enable row level security;

-- prescriptions visíveis quando:
--   - o utilizador é o for_user_id (uso pessoal), OU
--   - pertence à org da prescrição com capability prescription.read
do $$ begin
  create policy "prescriptions_visible" on prescriptions for select
    using (
      for_user_id = auth.uid()
      or org_id in (
        select org_id from org_members
        where user_id = auth.uid() and active=true
        and 'prescription.read' = any(coalesce(capabilities, default_capabilities(role)))
      )
    );
exception when duplicate_object then null; end $$;

-- write: precisa capability prescription.write
do $$ begin
  create policy "prescriptions_write" on prescriptions for insert
    with check (
      org_id in (
        select org_id from org_members
        where user_id = auth.uid() and active=true
        and 'prescription.write' = any(coalesce(capabilities, default_capabilities(role)))
      )
      or for_user_id = auth.uid()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "prescriptions_update" on prescriptions for update
    using (
      org_id in (
        select org_id from org_members
        where user_id = auth.uid() and active=true
        and 'prescription.write' = any(coalesce(capabilities, default_capabilities(role)))
      )
      or for_user_id = auth.uid()
    );
exception when duplicate_object then null; end $$;

-- items seguem a permissão da prescription (via subselect)
do $$ begin
  create policy "rx_items_via_prescription" on prescription_items for all
    using (
      prescription_id in (select id from prescriptions)
    )
    with check (
      prescription_id in (select id from prescriptions)
    );
exception when duplicate_object then null; end $$;

-- Touch
drop trigger if exists prescriptions_touch on prescriptions;
create trigger prescriptions_touch before update on prescriptions
  for each row execute procedure set_updated_at();

-- ─── Auto: assinar marca expires_at ─────────────────────────────────────────
create or replace function rx_on_sign() returns trigger
language plpgsql as $$
begin
  if new.status = 'signed' and old.status = 'draft' then
    new.signed_at := coalesce(new.signed_at, now());
    new.expires_at := coalesce(
      new.expires_at,
      (now()::date + coalesce(new.validity_days, 30))
    );
  end if;
  return new;
end;
$$;
drop trigger if exists prescriptions_sign on prescriptions;
create trigger prescriptions_sign before update on prescriptions
  for each row execute procedure rx_on_sign();
