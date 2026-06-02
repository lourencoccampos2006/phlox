-- sprint54_fhir_lab.sql
-- Phlox — Identificadores FHIR/SNS, integrações com laboratórios, ICD-10.
-- 2026-06-02.

-- ─── Identificadores standard nos utentes ───────────────────────────────────
-- Adiciona NIF (Número de Identificação Fiscal) e SNS (Número de Utente)
-- a patients e a profiles. Estes são os "Identifier.system" usados em FHIR.
do $$ begin
  alter table patients
    add column if not exists nif        text,
    add column if not exists sns_number text,
    add column if not exists nhs_number text,        -- compat. UK/internacional
    add column if not exists birth_date date,
    add column if not exists fhir_id    uuid default gen_random_uuid();
exception when undefined_table then null; end $$;

do $$ begin
  alter table profiles
    add column if not exists nif        text,
    add column if not exists sns_number text;
exception when undefined_table then null; end $$;

create index if not exists patients_sns_idx on patients(sns_number) where sns_number is not null;
create index if not exists patients_nif_idx on patients(nif) where nif is not null;
create index if not exists patients_fhir_idx on patients(fhir_id);

-- ─── Integrações com laboratórios externos ──────────────────────────────────
-- Cada laboratório (Synlab, Joaquim Chaves, Germano Sousa, etc.) recebe um
-- token único para enviar resultados via webhook FHIR Bundle.
create table if not exists lab_integrations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete cascade,
  name            text not null,                       -- "Synlab", "Joaquim Chaves"
  kind            text not null default 'lab' check (kind in ('lab','imaging','hospital','sus','other')),
  webhook_token   text not null unique,                -- 32 bytes URL-safe
  identifier_system text,                              -- ex: 'http://synlab.pt/order'
  active          boolean not null default true,
  last_received_at timestamptz,
  total_received  bigint not null default 0,
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists lab_integrations_org_idx on lab_integrations(org_id, active);
create index if not exists lab_integrations_token_idx on lab_integrations(webhook_token);

alter table lab_integrations enable row level security;
do $$ begin
  create policy "lab_integrations_org_visible" on lab_integrations for select
    using (org_id in (select org_id from org_members where user_id = auth.uid() and active=true));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "lab_integrations_org_admin" on lab_integrations for all
    using (
      org_id in (
        select org_id from org_members
        where user_id = auth.uid() and active=true
        and role in ('owner','admin')
      )
    )
    with check (
      org_id in (
        select org_id from org_members
        where user_id = auth.uid() and active=true
        and role in ('owner','admin')
      )
    );
exception when duplicate_object then null; end $$;

-- ─── Log de receção FHIR ────────────────────────────────────────────────────
-- Cada Bundle recebido é registado (id, hash, sender, status) para audit.
create table if not exists fhir_inbound_log (
  id            uuid primary key default gen_random_uuid(),
  integration_id uuid references lab_integrations(id) on delete set null,
  org_id        uuid references organizations(id) on delete cascade,
  received_at   timestamptz not null default now(),
  bundle_id     text,                                 -- Bundle.id se enviado
  resource_count int not null default 0,
  patient_matches int not null default 0,             -- quantos resources foram associados a patients
  observations_created int not null default 0,
  status        text not null default 'processed' check (status in ('processed','partial','error','rejected')),
  error_detail  text,
  raw_hash      text                                  -- sha256 do payload
);
create index if not exists fhir_inbound_org_idx on fhir_inbound_log(org_id, received_at desc);
alter table fhir_inbound_log enable row level security;
do $$ begin
  create policy "fhir_inbound_org_visible" on fhir_inbound_log for select
    using (org_id in (select org_id from org_members where user_id = auth.uid() and active=true));
exception when duplicate_object then null; end $$;

-- ─── Catálogo ICD-10 (mínimo) ───────────────────────────────────────────────
-- Seed com top diagnósticos comuns; expansível por importação.
create table if not exists icd10_codes (
  code        text primary key,
  label_pt    text not null,
  label_en    text,
  chapter     text,
  category    text
);

insert into icd10_codes (code, label_pt, chapter, category) values
  ('I10',    'Hipertensão essencial (primária)',              'IX', 'Doenças do aparelho circulatório'),
  ('I11',    'Cardiopatia hipertensiva',                       'IX', 'Doenças do aparelho circulatório'),
  ('I20',    'Angina de peito',                                'IX', 'Doenças do aparelho circulatório'),
  ('I21',    'Enfarte agudo do miocárdio',                     'IX', 'Doenças do aparelho circulatório'),
  ('I25',    'Doença isquémica crónica do coração',            'IX', 'Doenças do aparelho circulatório'),
  ('I48',    'Fibrilhação e flutter auricular',                'IX', 'Doenças do aparelho circulatório'),
  ('I50',    'Insuficiência cardíaca',                          'IX', 'Doenças do aparelho circulatório'),
  ('I63',    'Enfarte cerebral',                                'IX', 'Doenças do aparelho circulatório'),
  ('I64',    'AVC não especificado',                            'IX', 'Doenças do aparelho circulatório'),
  ('E10',    'Diabetes Mellitus tipo 1',                        'IV', 'Doenças endócrinas e metabólicas'),
  ('E11',    'Diabetes Mellitus tipo 2',                        'IV', 'Doenças endócrinas e metabólicas'),
  ('E78',    'Dislipidemia',                                    'IV', 'Doenças endócrinas e metabólicas'),
  ('E66',    'Obesidade',                                       'IV', 'Doenças endócrinas e metabólicas'),
  ('J44',    'Doença pulmonar obstrutiva crónica',              'X',  'Doenças do aparelho respiratório'),
  ('J45',    'Asma',                                            'X',  'Doenças do aparelho respiratório'),
  ('J18',    'Pneumonia, agente não especificado',              'X',  'Doenças do aparelho respiratório'),
  ('N18',    'Doença renal crónica',                            'XIV','Doenças do aparelho geniturinário'),
  ('N39',    'Infeção do tracto urinário',                      'XIV','Doenças do aparelho geniturinário'),
  ('F32',    'Episódio depressivo',                             'V',  'Transtornos mentais'),
  ('F41',    'Outros transtornos ansiosos',                     'V',  'Transtornos mentais'),
  ('F00',    'Demência na doença de Alzheimer',                 'V',  'Transtornos mentais'),
  ('F03',    'Demência não especificada',                       'V',  'Transtornos mentais'),
  ('G20',    'Doença de Parkinson',                             'VI', 'Doenças do sistema nervoso'),
  ('G40',    'Epilepsia',                                       'VI', 'Doenças do sistema nervoso'),
  ('K21',    'Doença de refluxo gastroesofágico',               'XI', 'Doenças do aparelho digestivo'),
  ('K57',    'Diverticulose',                                   'XI', 'Doenças do aparelho digestivo'),
  ('M81',    'Osteoporose',                                     'XIII','Doenças osteoarticulares'),
  ('M19',    'Outras artroses',                                 'XIII','Doenças osteoarticulares'),
  ('Z00',    'Exame geral / consulta de rotina',                'XXI','Códigos Z (consulta sem doença)'),
  ('Z71',    'Pessoa em consulta para aconselhamento',          'XXI','Códigos Z')
on conflict (code) do nothing;

-- Função utilitária — pesquisa fulltext em ICD
create or replace function search_icd10(q text, lim int default 10)
returns table(code text, label_pt text)
language sql stable as $$
  select code, label_pt from icd10_codes
  where label_pt ilike '%' || q || '%' or code ilike q || '%'
  order by length(label_pt)
  limit lim;
$$;

-- Touch
drop trigger if exists lab_integrations_touch on lab_integrations;
create trigger lab_integrations_touch before update on lab_integrations
  for each row execute procedure set_updated_at();
