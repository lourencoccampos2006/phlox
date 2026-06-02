-- sprint56_hospital.sql
-- Phlox — Hospital: alas, camas, triagem Manchester, bloco operatório.
--
-- Modelo:
--   ─ wards (alas/serviços)
--   ─ beds (camas, com estado e ocupação por episódio)
--   ─ triage_assessments (triagem Manchester por episódio de urgência)
--   ─ surgeries (intervenções no bloco operatório)
--   ─ surgery_team (equipa da intervenção)
--
-- Todas as tabelas estão ancoradas em org_id e protegidas via has_capability.
-- 2026-06-02.

-- ─── Novas capabilities ────────────────────────────────────────────────────
insert into capability_catalog (key, category, label, description, level) values
  ('beds.read',      'hospital', 'Ver mapa de camas',          'Consulta o estado e ocupação das camas',                      'read'),
  ('beds.write',     'hospital', 'Gerir camas',                'Admite, transfere, dá alta, altera estado',                   'write'),
  ('triage.read',    'hospital', 'Ver triagem',                'Vê fila de triagem da urgência',                              'read'),
  ('triage.write',   'hospital', 'Triagem Manchester',         'Atribui prioridade Manchester (vermelho→azul)',               'write'),
  ('surgery.read',   'hospital', 'Ver bloco operatório',       'Lê agenda do bloco',                                          'read'),
  ('surgery.write',  'hospital', 'Gerir bloco operatório',     'Agenda, regista início/fim, equipa',                          'write')
  on conflict (key) do nothing;

-- ─── Atribui as novas capabilities aos roles default ──────────────────────
-- Refresca default_capabilities para incluir hospital onde faz sentido.
create or replace function default_capabilities(role text) returns text[]
language plpgsql immutable as $$
begin
  return case role
    when 'owner' then
      array(select key from capability_catalog)
    when 'admin' then
      array['patients.read','patients.write','patients.delete',
            'episodes.read','episodes.write',
            'prescription.read','prescription.validate',
            'mar.read','rounds.read','rounds.write',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'billing.read','billing.write','billing.fiscal_export','pos.use',
            'team.read','team.manage','team.schedule',
            'quality.read','quality.write','audit.read','org.admin',
            'beds.read','beds.write','triage.read','surgery.read','surgery.write']
    when 'clinician' then
      array['patients.read','patients.write',
            'episodes.read','episodes.write',
            'prescription.read','prescription.write',
            'mar.read','rounds.read','rounds.write',
            'quality.read','team.read',
            'beds.read','beds.write','triage.read','triage.write',
            'surgery.read','surgery.write']
    when 'pharmacist' then
      array['patients.read',
            'prescription.read','prescription.validate',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'rounds.read','rounds.write',
            'billing.read','billing.write','pos.use',
            'quality.read','team.read',
            'beds.read']
    when 'nurse' then
      array['patients.read','patients.write',
            'episodes.read',
            'prescription.read',
            'mar.read','mar.administer',
            'rounds.read',
            'quality.write','team.read',
            'beds.read','beds.write','triage.read','triage.write',
            'surgery.read']
    when 'assistant' then
      array['patients.read',
            'episodes.read',
            'billing.read','billing.write','pos.use',
            'team.read',
            'beds.read']
    when 'accountant' then
      array['billing.read','billing.write','billing.fiscal_export',
            'org.billing_settings']
    when 'viewer' then
      array['patients.read','episodes.read','prescription.read',
            'mar.read','rounds.read','stock.read','billing.read',
            'team.read','quality.read',
            'beds.read','triage.read','surgery.read']
    when 'student' then
      array['patients.read','prescription.read','mar.read','rounds.read',
            'beds.read','triage.read','surgery.read']
    when 'caregiver' then
      array['patients.read','mar.read','mar.administer']
    when 'self' then
      array['patients.read']
    else array[]::text[]
  end;
end;
$$;

-- ─── Wards (alas/serviços) ─────────────────────────────────────────────────
create table if not exists wards (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  code          text,                              -- ex: MED2, CIR1, UCI
  kind          text not null check (kind in (
                  'internamento','urgencia','uci','uciped',
                  'pediatria','obstetricia','psiquiatria',
                  'oncologia','ambulatorio','outro'
                )),
  floor         text,
  capacity      int default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists wards_org_idx on wards(org_id) where active = true;

-- ─── Beds (camas) ──────────────────────────────────────────────────────────
create table if not exists beds (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  ward_id             uuid not null references wards(id) on delete cascade,
  label               text not null,                  -- ex: "203-A", "Box 4"
  bed_type            text default 'standard' check (bed_type in (
                        'standard','isolation','intensive','pediatric',
                        'maternity','psychiatric','observation','other'
                      )),
  status              text not null default 'free' check (status in (
                        'free','occupied','cleaning','maintenance','reserved','blocked'
                      )),
  current_episode_id  uuid references episodes(id) on delete set null,
  current_patient_id  uuid references patients(id) on delete set null,
  occupied_since      timestamptz,
  notes               text,
  active              boolean not null default true,
  updated_at          timestamptz not null default now()
);
create index if not exists beds_ward_idx on beds(ward_id) where active = true;
create index if not exists beds_org_status_idx on beds(org_id, status) where active = true;
create unique index if not exists beds_ward_label_unq on beds(ward_id, label) where active = true;

drop trigger if exists beds_touch on beds;
create trigger beds_touch before update on beds
  for each row execute procedure set_updated_at();

-- ─── Triage assessments (Manchester) ───────────────────────────────────────
create table if not exists triage_assessments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  patient_id    uuid references patients(id) on delete set null,
  episode_id    uuid references episodes(id) on delete set null,
  triaged_by    uuid references auth.users(id),
  -- Manchester Triage System: 1=vermelho(emergente), 2=laranja(muito urgente),
  -- 3=amarelo(urgente), 4=verde(pouco urgente), 5=azul(não urgente)
  priority      int not null check (priority between 1 and 5),
  flowchart     text,                              -- ex: "dor torácica", "dispneia"
  discriminator text,                              -- ex: "choque", "dor severa"
  reason        text not null,                     -- motivo de vinda
  vitals        jsonb,                             -- ta, fc, fr, spo2, temp, glic
  pain_score    int check (pain_score between 0 and 10),
  notes         text,
  -- Tempo alvo até ver médico (minutos)
  target_minutes int generated always as (
    case priority
      when 1 then 0      -- imediato
      when 2 then 10
      when 3 then 60
      when 4 then 120
      when 5 then 240
    end
  ) stored,
  seen_at       timestamptz,
  seen_by       uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index if not exists triage_org_pending_idx on triage_assessments(org_id, priority, created_at)
  where seen_at is null;
create index if not exists triage_episode_idx on triage_assessments(episode_id);

-- ─── Surgeries (bloco operatório) ──────────────────────────────────────────
create table if not exists surgeries (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  patient_id          uuid not null references patients(id) on delete cascade,
  episode_id          uuid references episodes(id) on delete set null,
  procedure_code      text,                                  -- CID-9-MC ou local
  procedure_name      text not null,
  specialty           text,                                  -- cirurgia geral, ortopedia, etc.
  surgeon_id          uuid references auth.users(id),
  anaesthetist_id     uuid references auth.users(id),
  -- Anestesia
  anaesthesia_kind    text check (anaesthesia_kind in (
                        'geral','regional','locorregional','local','sedacao','nenhuma'
                      ) or anaesthesia_kind is null),
  -- ASA score 1-6 (E para emergente sufixo)
  asa_score           int check (asa_score between 1 and 6),
  asa_emergent        boolean default false,
  -- Sala de bloco
  operating_room      text,
  -- Estado do circuito
  status              text not null default 'scheduled' check (status in (
                        'scheduled','arrived','induction','in_progress',
                        'closing','recovery','completed','cancelled'
                      )),
  -- Tempos
  scheduled_start     timestamptz,
  scheduled_duration  int,                                   -- minutos previstos
  arrived_at          timestamptz,
  induction_at        timestamptz,
  incision_at         timestamptz,
  closure_at          timestamptz,
  recovery_at         timestamptz,
  completed_at        timestamptz,
  -- Resultado e notas
  outcome             text check (outcome in ('success','complication','cancelled','converted','death') or outcome is null),
  complication_notes  text,
  surgical_notes      text,
  -- Checklist OMS de segurança cirúrgica (sign-in/time-out/sign-out)
  signin_done         boolean default false,
  signin_at           timestamptz,
  timeout_done        boolean default false,
  timeout_at          timestamptz,
  signout_done        boolean default false,
  signout_at          timestamptz,
  -- Material e profilaxia
  prophylaxis_abx     text,
  implants_used       jsonb,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists surgeries_org_sched_idx on surgeries(org_id, scheduled_start)
  where status not in ('completed','cancelled');
create index if not exists surgeries_patient_idx on surgeries(patient_id, scheduled_start desc);
create index if not exists surgeries_room_idx on surgeries(org_id, operating_room, scheduled_start);

drop trigger if exists surgeries_touch on surgeries;
create trigger surgeries_touch before update on surgeries
  for each row execute procedure set_updated_at();

-- ─── Equipa da intervenção (extra além de surgeon/anaesthetist) ────────────
create table if not exists surgery_team (
  id            uuid primary key default gen_random_uuid(),
  surgery_id    uuid not null references surgeries(id) on delete cascade,
  user_id       uuid references auth.users(id),
  external_name text,                                       -- se não for membro
  role          text not null check (role in (
                  'assistant','scrub_nurse','circulating_nurse',
                  'anaesthesia_tech','perfusionist','student','observer','other'
                )),
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists surgery_team_surgery_idx on surgery_team(surgery_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table wards              enable row level security;
alter table beds               enable row level security;
alter table triage_assessments enable row level security;
alter table surgeries          enable row level security;
alter table surgery_team       enable row level security;

-- Wards
do $$ begin
  create policy "wards_read" on wards for select
    using (has_capability(auth.uid(), org_id, 'beds.read'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "wards_write" on wards for all
    using (has_capability(auth.uid(), org_id, 'beds.write'))
    with check (has_capability(auth.uid(), org_id, 'beds.write'));
exception when duplicate_object then null; end $$;

-- Beds
do $$ begin
  create policy "beds_read" on beds for select
    using (has_capability(auth.uid(), org_id, 'beds.read'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "beds_write" on beds for all
    using (has_capability(auth.uid(), org_id, 'beds.write'))
    with check (has_capability(auth.uid(), org_id, 'beds.write'));
exception when duplicate_object then null; end $$;

-- Triage
do $$ begin
  create policy "triage_read" on triage_assessments for select
    using (has_capability(auth.uid(), org_id, 'triage.read'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "triage_write" on triage_assessments for all
    using (has_capability(auth.uid(), org_id, 'triage.write'))
    with check (has_capability(auth.uid(), org_id, 'triage.write'));
exception when duplicate_object then null; end $$;

-- Surgeries
do $$ begin
  create policy "surgeries_read" on surgeries for select
    using (has_capability(auth.uid(), org_id, 'surgery.read'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "surgeries_write" on surgeries for all
    using (has_capability(auth.uid(), org_id, 'surgery.write'))
    with check (has_capability(auth.uid(), org_id, 'surgery.write'));
exception when duplicate_object then null; end $$;

-- Surgery team segue a permissão da surgery
do $$ begin
  create policy "surgery_team_read" on surgery_team for select
    using (surgery_id in (
      select id from surgeries
      where has_capability(auth.uid(), org_id, 'surgery.read')
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "surgery_team_write" on surgery_team for all
    using (surgery_id in (
      select id from surgeries
      where has_capability(auth.uid(), org_id, 'surgery.write')
    ))
    with check (surgery_id in (
      select id from surgeries
      where has_capability(auth.uid(), org_id, 'surgery.write')
    ));
exception when duplicate_object then null; end $$;

-- ─── Triggers de coerência: bed.status ↔ current_episode_id ────────────────
create or replace function beds_sync_status() returns trigger
language plpgsql as $$
begin
  -- Se foi associado um episódio, marca como ocupada e regista hora
  if new.current_episode_id is not null and (old.current_episode_id is distinct from new.current_episode_id) then
    new.status := 'occupied';
    new.occupied_since := coalesce(new.occupied_since, now());
  end if;
  -- Se libertou episódio, marca limpeza (excepto se já está noutro estado)
  if new.current_episode_id is null and old.current_episode_id is not null and new.status = 'occupied' then
    new.status := 'cleaning';
    new.current_patient_id := null;
    new.occupied_since := null;
  end if;
  return new;
end;
$$;

drop trigger if exists beds_sync on beds;
create trigger beds_sync before update on beds
  for each row execute procedure beds_sync_status();

-- ─── View: ocupação por ala ────────────────────────────────────────────────
create or replace view ward_occupancy as
  select
    w.id           as ward_id,
    w.org_id,
    w.name         as ward_name,
    w.kind,
    count(b.id)                                       as total_beds,
    count(b.id) filter (where b.status = 'occupied')  as occupied,
    count(b.id) filter (where b.status = 'free')      as free,
    count(b.id) filter (where b.status = 'cleaning')  as cleaning,
    count(b.id) filter (where b.status in ('maintenance','blocked')) as out_of_service,
    round(100.0 * count(b.id) filter (where b.status = 'occupied') / nullif(count(b.id), 0), 1) as occupancy_pct
  from wards w
  left join beds b on b.ward_id = w.id and b.active = true
  where w.active = true
  group by w.id, w.org_id, w.name, w.kind;
