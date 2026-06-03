-- sprint64_crm_telemedicine.sql
-- Phlox — CRM (contactos não-doentes), Telemedicina (consultas remotas),
-- Tradução automática (cache de traduções).
--
-- Casos de uso:
--   ─ CRM: gestão de leads, prospectos, parceiros (não doentes)
--   ─ Telemedicina: agendamento, salas virtuais, consentimento, gravação
--   ─ Tradução: cache para PT-PT ↔ EN/ES/FR/UK (cuidadores migrantes)
--
-- 2026-06-03.

-- ─── Capabilities ────────────────────────────────────────────────────────
insert into capability_catalog (key, category, label, description, level) values
  ('crm.read',         'crm',      'Ver CRM',                'Acede a contactos e pipeline',                'read'),
  ('crm.write',        'crm',      'Gerir CRM',              'Cria contactos, leads, oportunidades',        'write'),
  ('telemed.read',     'telemed',  'Ver telemedicina',       'Lista consultas virtuais',                    'read'),
  ('telemed.write',    'telemed',  'Conduzir telemedicina',  'Agendar e dar consultas remotas',             'write'),
  ('translate.use',    'translate','Usar tradução',          'Traduzir texto via IA com cache',             'read')
  on conflict (key) do nothing;

-- Refresca defaults para incluir as novas capabilities
create or replace function default_capabilities(role text) returns text[]
language plpgsql immutable as $$
begin
  return case role
    when 'owner' then array(select key from capability_catalog)
    when 'admin' then
      array['patients.read','patients.write','patients.delete',
            'episodes.read','episodes.write',
            'prescription.read','prescription.validate',
            'mar.read','rounds.read','rounds.write',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'billing.read','billing.write','billing.fiscal_export','pos.use',
            'team.read','team.manage','team.schedule',
            'quality.read','quality.write','audit.read','org.admin',
            'beds.read','beds.write','triage.read','surgery.read','surgery.write',
            'suppliers.read','suppliers.write','loyalty.read','loyalty.write',
            'bi.use','automation.read','automation.write','agent.use',
            'crm.read','crm.write','telemed.read','telemed.write','translate.use']
    when 'clinician' then
      array['patients.read','patients.write','episodes.read','episodes.write',
            'prescription.read','prescription.write','mar.read','rounds.read','rounds.write',
            'quality.read','team.read',
            'beds.read','beds.write','triage.read','triage.write','surgery.read','surgery.write',
            'bi.use','automation.read','agent.use',
            'telemed.read','telemed.write','translate.use']
    when 'pharmacist' then
      array['patients.read','prescription.read','prescription.validate',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'rounds.read','rounds.write','billing.read','billing.write','pos.use',
            'quality.read','team.read','beds.read',
            'suppliers.read','suppliers.write','loyalty.read','loyalty.write',
            'bi.use','automation.read','agent.use',
            'crm.read','crm.write','translate.use']
    when 'nurse' then
      array['patients.read','patients.write','episodes.read',
            'prescription.read','mar.read','mar.administer',
            'rounds.read','quality.write','team.read',
            'beds.read','beds.write','triage.read','triage.write','surgery.read','bi.use',
            'telemed.read','translate.use']
    when 'assistant' then
      array['patients.read','episodes.read','billing.read','billing.write','pos.use','team.read','beds.read','loyalty.read','loyalty.write','crm.read','crm.write','translate.use']
    when 'accountant' then
      array['billing.read','billing.write','billing.fiscal_export','org.billing_settings','suppliers.read','bi.use','crm.read']
    when 'viewer' then
      array['patients.read','episodes.read','prescription.read','mar.read','rounds.read','stock.read','billing.read','team.read','quality.read','beds.read','triage.read','surgery.read','suppliers.read','loyalty.read','bi.use','automation.read','crm.read','telemed.read','translate.use']
    when 'student' then array['patients.read','prescription.read','mar.read','rounds.read','beds.read','triage.read','surgery.read','translate.use']
    when 'caregiver' then array['patients.read','mar.read','mar.administer','translate.use']
    when 'self' then array['patients.read','translate.use']
    else array[]::text[]
  end;
end;
$$;

-- ─── CRM Contacts ────────────────────────────────────────────────────────
create table if not exists crm_contacts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  kind          text not null check (kind in (
                  'lead','prospect','customer','partner','supplier_contact','other'
                )),
  name          text not null,
  email         text,
  phone         text,
  company       text,
  job_title     text,
  vat_number    text,
  city          text,
  source        text,                                -- ex: 'website', 'feira', 'referência'
  -- Pipeline
  stage         text default 'new' check (stage in (
                  'new','qualified','contacted','proposal','won','lost','dormant'
                )),
  value_eur     numeric(12,2),                       -- valor estimado da oportunidade
  expected_close date,
  -- Dados livres / etiquetas
  tags          text[],
  notes         text,
  -- Ligações opcionais
  patient_id    uuid references patients(id) on delete set null,
  loyalty_member_id uuid,                            -- ref. opcional a loyalty_members
  consent_marketing boolean default false,
  consent_data_share boolean default false,
  -- Tracking
  owner_user_id uuid references auth.users(id),
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists crm_contacts_org_stage_idx on crm_contacts(org_id, stage);
create index if not exists crm_contacts_owner_idx on crm_contacts(owner_user_id);
create index if not exists crm_contacts_followup_idx on crm_contacts(org_id, next_followup_at) where next_followup_at is not null;

drop trigger if exists crm_contacts_touch on crm_contacts;
create trigger crm_contacts_touch before update on crm_contacts
  for each row execute procedure set_updated_at();

-- ─── CRM Activities (interações) ─────────────────────────────────────────
create table if not exists crm_activities (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  contact_id    uuid not null references crm_contacts(id) on delete cascade,
  kind          text not null check (kind in (
                  'call','email','meeting','sms','whatsapp','visit','note','task'
                )),
  subject       text,
  body          text,
  due_at        timestamptz,
  done          boolean not null default false,
  done_at       timestamptz,
  done_by       uuid references auth.users(id),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index if not exists crm_activities_contact_idx on crm_activities(contact_id, created_at desc);
create index if not exists crm_activities_org_due_idx on crm_activities(org_id, due_at) where done = false;

-- ─── Telemedicina ────────────────────────────────────────────────────────
create table if not exists telemed_sessions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  patient_id    uuid references patients(id) on delete set null,
  -- Profissionais
  clinician_id  uuid references auth.users(id),
  -- Estado da sessão
  status        text not null default 'scheduled' check (status in (
                  'scheduled','waiting','in_progress','completed','cancelled','no_show'
                )),
  -- Tempos
  scheduled_at  timestamptz not null,
  duration_min  int default 20,
  started_at    timestamptz,
  ended_at      timestamptz,
  -- Sala virtual
  room_token    text unique,                         -- token URL-safe da sala
  provider      text default 'phlox',                -- ex: 'jitsi', 'twilio', 'webrtc'
  recording_url text,
  recording_consent boolean default false,
  -- Conteúdo
  motive        text,                                -- motivo da consulta
  encounter_summary text,                            -- nota clínica resultante
  prescription_id uuid,                              -- ref. opcional a prescription
  -- Pagamento
  fee_eur       numeric(8,2),
  paid          boolean default false,
  -- Vínculo a episódio
  episode_id    uuid references episodes(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists telemed_org_status_idx on telemed_sessions(org_id, status, scheduled_at);
create index if not exists telemed_clinician_idx on telemed_sessions(clinician_id, scheduled_at desc);
create index if not exists telemed_patient_idx on telemed_sessions(patient_id, scheduled_at desc);

drop trigger if exists telemed_touch on telemed_sessions;
create trigger telemed_touch before update on telemed_sessions
  for each row execute procedure set_updated_at();

-- ───  Trigger: gera token se vazio ───────────────────────────────────────
create or replace function telemed_set_token() returns trigger
language plpgsql as $$
begin
  if new.room_token is null then
    new.room_token := replace(replace(replace(encode(gen_random_bytes(18), 'base64'),'+','-'),'/','_'),'=','');
  end if;
  return new;
end;
$$;
drop trigger if exists telemed_token on telemed_sessions;
create trigger telemed_token before insert on telemed_sessions
  for each row execute procedure telemed_set_token();

-- ─── Tradução: cache ─────────────────────────────────────────────────────
create table if not exists translations_cache (
  id            uuid primary key default gen_random_uuid(),
  source_text   text not null,
  source_lang   text not null,                       -- 'pt', 'en', 'es', 'fr', 'uk', 'auto'
  target_lang   text not null,
  translated    text not null,
  hash          text not null,                       -- sha-256 de source_lang|target_lang|source_text
  hit_count     int not null default 1,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now(),
  unique(hash)
);
create index if not exists translations_hash_idx on translations_cache(hash);
create index if not exists translations_lru_idx on translations_cache(last_used_at);

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table crm_contacts       enable row level security;
alter table crm_activities     enable row level security;
alter table telemed_sessions   enable row level security;
alter table translations_cache enable row level security;

-- CRM
do $$ begin
  create policy "crm_contacts_read" on crm_contacts for select
    using (has_capability(auth.uid(), org_id, 'crm.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm_contacts_write" on crm_contacts for all
    using (has_capability(auth.uid(), org_id, 'crm.write'))
    with check (has_capability(auth.uid(), org_id, 'crm.write'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "crm_activities_read" on crm_activities for select
    using (has_capability(auth.uid(), org_id, 'crm.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm_activities_write" on crm_activities for all
    using (has_capability(auth.uid(), org_id, 'crm.write'))
    with check (has_capability(auth.uid(), org_id, 'crm.write'));
exception when duplicate_object then null; end $$;

-- Telemedicina
do $$ begin
  create policy "telemed_read" on telemed_sessions for select
    using (has_capability(auth.uid(), org_id, 'telemed.read') or clinician_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "telemed_write" on telemed_sessions for all
    using (has_capability(auth.uid(), org_id, 'telemed.write') or clinician_id = auth.uid())
    with check (has_capability(auth.uid(), org_id, 'telemed.write') or clinician_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Translations cache — acessível a qualquer autenticado (read-only)
do $$ begin
  create policy "translations_read" on translations_cache for select
    using (auth.uid() is not null);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "translations_write" on translations_cache for insert
    with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "translations_update" on translations_cache for update
    using (auth.uid() is not null)
    with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;

-- ─── View: pipeline CRM por estado ───────────────────────────────────────
create or replace view crm_pipeline as
  select
    org_id,
    stage,
    count(*) as deals,
    coalesce(sum(value_eur), 0) as total_value,
    coalesce(avg(value_eur), 0) as avg_value
  from crm_contacts
  where stage not in ('lost','dormant')
  group by org_id, stage;

notify pgrst, 'reload schema';
