-- sprint51_episodes.sql
-- Phlox — Episódios clínicos (ambulatório, internamento, urgência, tele).
--
-- Cada utente pode ter vários episódios. Notas, MCDT, prescrições e MAR
-- penduram-se opcionalmente num episódio para contexto temporal.

create table if not exists episodes (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid references organizations(id) on delete cascade,
  patient_id          uuid references patients(id) on delete cascade,
  kind                text not null check (kind in (
                        'ambulatorio','internamento','urgencia',
                        'tele','domiciliario','outro'
                      )),
  start_at            timestamptz not null default now(),
  end_at              timestamptz,
  status              text not null default 'open' check (status in ('open','closed','cancelled')),
  attending_user_id   uuid references auth.users(id),
  primary_complaint   text,
  diagnosis_codes     text[],                            -- ICD-10/ICPC
  bed_id              uuid,                              -- ref. futura (bed mgmt)
  ward                text,
  triage_level        int check (triage_level between 1 and 5),  -- Manchester
  discharge_summary   text,
  destination         text check (destination in ('home','transfer','death','left_ama','other') or destination is null),
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists episodes_patient_idx on episodes(patient_id, start_at desc);
create index if not exists episodes_org_status_idx on episodes(org_id, status, start_at desc);
create index if not exists episodes_open_idx on episodes(patient_id) where status = 'open';

alter table episodes enable row level security;

do $$ begin
  create policy "episodes_org_visible" on episodes for select
    using (
      org_id is null
      or org_id in (select org_id from org_members where user_id = auth.uid() and active = true)
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "episodes_org_writable" on episodes for all
    using (
      org_id in (
        select org_id from org_members
        where user_id = auth.uid() and active = true
        and 'episodes.write' = any(coalesce(capabilities, default_capabilities(role)))
      )
    )
    with check (
      org_id in (
        select org_id from org_members
        where user_id = auth.uid() and active = true
        and 'episodes.write' = any(coalesce(capabilities, default_capabilities(role)))
      )
    );
exception when duplicate_object then null; end $$;

-- Touch updated_at
drop trigger if exists episodes_touch on episodes;
create trigger episodes_touch before update on episodes
  for each row execute procedure set_updated_at();

-- ─── Ligações opcionais a episode ───────────────────────────────────────────
-- Adiciona episode_id (nullable) onde faz sentido. Tudo tolerante a tabelas
-- ausentes (do block).
do $$ begin
  alter table patient_meds add column if not exists episode_id uuid references episodes(id) on delete set null;
exception when undefined_table then null; end $$;

do $$ begin
  alter table mar_records add column if not exists episode_id uuid references episodes(id) on delete set null;
exception when undefined_table then null; end $$;

do $$ begin
  alter table pcne_interventions add column if not exists episode_id uuid references episodes(id) on delete set null;
exception when undefined_table then null; end $$;

do $$ begin
  alter table care_records add column if not exists episode_id uuid references episodes(id) on delete set null;
exception when undefined_table then null; end $$;

do $$ begin
  alter table assessments add column if not exists episode_id uuid references episodes(id) on delete set null;
exception when undefined_table then null; end $$;

-- ─── View: episódio aberto atual por utente ─────────────────────────────────
create or replace view current_open_episode as
  select distinct on (patient_id) *
  from episodes
  where status = 'open'
  order by patient_id, start_at desc;
