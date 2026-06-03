-- sprint59_automation.sql
-- Phlox — BI conversacional + workflow automation + agentes autónomos.
--
-- Componentes:
--   ─ ai_queries          (histórico de perguntas BI → SQL → resposta)
--   ─ automations         (regras: WHEN / IF / THEN)
--   ─ automation_runs     (execuções com resultado)
--   ─ agent_tasks         (tarefas geradas autonomamente por agentes)
--   ─ kpi_snapshots       (snapshot diário de KPIs por org)
--
-- BI conversacional: o utilizador pergunta em linguagem natural; o backend
-- gera uma SQL controlada (read-only, AS SELECT, com whitelist de tabelas) e
-- guarda em ai_queries. As regras de automação correm via cron.
--
-- 2026-06-02.

-- ─── Capabilities ─────────────────────────────────────────────────────────
insert into capability_catalog (key, category, label, description, level) values
  ('bi.use',           'bi',         'BI conversacional',   'Faz perguntas em linguagem natural e vê KPIs',  'read'),
  ('automation.read',  'automation', 'Ver automações',      '',                                              'read'),
  ('automation.write', 'automation', 'Gerir automações',    'Cria, edita e desactiva regras',                'write'),
  ('agent.use',        'automation', 'Tarefas de agentes',  'Vê e gere o que os agentes propõem',            'write')
  on conflict (key) do nothing;

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
            'bi.use','automation.read','automation.write','agent.use']
    when 'clinician' then
      array['patients.read','patients.write','episodes.read','episodes.write',
            'prescription.read','prescription.write','mar.read','rounds.read','rounds.write',
            'quality.read','team.read',
            'beds.read','beds.write','triage.read','triage.write','surgery.read','surgery.write',
            'bi.use','automation.read','agent.use']
    when 'pharmacist' then
      array['patients.read','prescription.read','prescription.validate',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'rounds.read','rounds.write','billing.read','billing.write','pos.use',
            'quality.read','team.read','beds.read',
            'suppliers.read','suppliers.write','loyalty.read','loyalty.write',
            'bi.use','automation.read','agent.use']
    when 'nurse' then
      array['patients.read','patients.write','episodes.read',
            'prescription.read','mar.read','mar.administer',
            'rounds.read','quality.write','team.read',
            'beds.read','beds.write','triage.read','triage.write','surgery.read',
            'bi.use']
    when 'assistant' then
      array['patients.read','episodes.read','billing.read','billing.write','pos.use','team.read','beds.read','loyalty.read','loyalty.write']
    when 'accountant' then
      array['billing.read','billing.write','billing.fiscal_export','org.billing_settings','suppliers.read','bi.use']
    when 'viewer' then
      array['patients.read','episodes.read','prescription.read','mar.read','rounds.read','stock.read','billing.read','team.read','quality.read','beds.read','triage.read','surgery.read','suppliers.read','loyalty.read','bi.use','automation.read']
    when 'student' then array['patients.read','prescription.read','mar.read','rounds.read','beds.read','triage.read','surgery.read']
    when 'caregiver' then array['patients.read','mar.read','mar.administer']
    when 'self' then array['patients.read']
    else array[]::text[]
  end;
end;
$$;

-- ─── ai_queries (histórico BI) ────────────────────────────────────────────
create table if not exists ai_queries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  asked_by      uuid not null references auth.users(id) on delete cascade,
  question      text not null,
  -- SQL gerada pelo modelo e validada (read-only, whitelist)
  generated_sql text,
  -- Resposta para o utilizador (em PT-PT)
  answer        text,
  -- Resultado tabular (até primeiras 50 linhas) ou agregação
  result_json   jsonb,
  rows_returned int,
  -- Modelo usado e telemetria
  model         text,
  duration_ms   int,
  error         text,
  -- Pin para reabrir como "dashboard"
  pinned        boolean not null default false,
  pin_label     text,
  created_at    timestamptz not null default now()
);
create index if not exists ai_queries_org_idx on ai_queries(org_id, created_at desc);
create index if not exists ai_queries_pinned_idx on ai_queries(org_id) where pinned = true;

-- ─── automations ─────────────────────────────────────────────────────────
-- Modelo simples: trigger_kind (cron|event), trigger_expr (cron OR event name),
-- condition (jsonb), actions (jsonb[]).
create table if not exists automations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  description   text,
  trigger_kind  text not null check (trigger_kind in (
                  'cron','event','threshold','schedule'
                )),
  trigger_expr  text not null,                       -- ex: "0 7 * * *" ou "patient.admitted"
  condition     jsonb default '{}'::jsonb,           -- ex: {"ward":"UCI","priority":">=4"}
  actions       jsonb not null,                      -- array de { kind, params }
  enabled       boolean not null default true,
  last_run_at   timestamptz,
  last_status   text,
  run_count     int not null default 0,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists automations_org_idx on automations(org_id) where enabled = true;

drop trigger if exists automations_touch on automations;
create trigger automations_touch before update on automations
  for each row execute procedure set_updated_at();

-- ─── automation_runs ─────────────────────────────────────────────────────
create table if not exists automation_runs (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  status        text not null check (status in ('ok','skip','error')),
  matched_count int default 0,                       -- nº registos que cumpriram a condição
  actions_done  jsonb,
  error         text,
  duration_ms   int,
  started_at    timestamptz not null default now()
);
create index if not exists automation_runs_idx on automation_runs(automation_id, started_at desc);

-- ─── agent_tasks ─────────────────────────────────────────────────────────
-- Sugestões/decisões propostas por agentes (ex.: "reordena Ibuprofeno 600mg",
-- "atribui prioridade 2 ao doente em obs há > 30min"). O humano valida.
create table if not exists agent_tasks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  agent_name    text not null,                       -- ex: "stock-watch", "triage-helper"
  kind          text not null,                       -- ex: "reorder", "escalate", "remind"
  title         text not null,
  reason        text,                                -- justificação humana-legível
  payload       jsonb,                               -- dados estruturados para acção
  status        text not null default 'open' check (status in (
                  'open','acknowledged','done','dismissed','expired'
                )),
  priority      int default 3 check (priority between 1 and 5),
  assigned_to   uuid references auth.users(id),
  due_at        timestamptz,
  resolved_by   uuid references auth.users(id),
  resolved_at   timestamptz,
  resolution    text,
  source_run_id uuid references automation_runs(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists agent_tasks_org_idx on agent_tasks(org_id, status, priority, created_at desc);

-- ─── kpi_snapshots ───────────────────────────────────────────────────────
-- Foto diária de KPIs por org. Permite comparar tendências sem recalcular tudo.
create table if not exists kpi_snapshots (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  snapshot_date date not null,
  metric        text not null,
  value         numeric,
  meta          jsonb,
  created_at    timestamptz not null default now(),
  unique(org_id, snapshot_date, metric)
);
create index if not exists kpi_snapshots_org_idx on kpi_snapshots(org_id, snapshot_date desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table ai_queries         enable row level security;
alter table automations        enable row level security;
alter table automation_runs    enable row level security;
alter table agent_tasks        enable row level security;
alter table kpi_snapshots      enable row level security;

do $$ begin
  create policy "aiq_read" on ai_queries for select
    using (has_capability(auth.uid(), org_id, 'bi.use'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "aiq_write" on ai_queries for insert
    with check (has_capability(auth.uid(), org_id, 'bi.use') and asked_by = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "aiq_update_own" on ai_queries for update
    using (asked_by = auth.uid())
    with check (asked_by = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auto_read" on automations for select
    using (has_capability(auth.uid(), org_id, 'automation.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auto_write" on automations for all
    using (has_capability(auth.uid(), org_id, 'automation.write'))
    with check (has_capability(auth.uid(), org_id, 'automation.write'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "autorun_read" on automation_runs for select
    using (has_capability(auth.uid(), org_id, 'automation.read'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "agent_read" on agent_tasks for select
    using (has_capability(auth.uid(), org_id, 'agent.use'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "agent_write" on agent_tasks for all
    using (has_capability(auth.uid(), org_id, 'agent.use'))
    with check (has_capability(auth.uid(), org_id, 'agent.use'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "kpi_read" on kpi_snapshots for select
    using (has_capability(auth.uid(), org_id, 'bi.use') or has_capability(auth.uid(), org_id, 'quality.read'));
exception when duplicate_object then null; end $$;

-- ─── Função BI: executa SQL controlada e devolve JSON ────────────────────
-- Apenas SELECT. Schema = public. Limita a 200 linhas.
create or replace function bi_run_query(p_sql text) returns jsonb
language plpgsql security invoker as $$
declare
  result jsonb;
  upper_sql text := upper(trim(p_sql));
begin
  if upper_sql not like 'SELECT%' then
    raise exception 'Apenas SELECT é permitido';
  end if;
  if upper_sql ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|COPY|MERGE)' then
    raise exception 'Comando não permitido';
  end if;
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s limit 200) t', p_sql) into result;
  return result;
end;
$$;

-- ─── Snapshot diário (utilitário; pode ser chamado por cron externo) ─────
create or replace function snapshot_org_kpis(p_org uuid) returns int
language plpgsql security invoker as $$
declare
  today date := current_date;
  inserted int := 0;
begin
  -- KPI 1: doentes activos (com episódio aberto)
  insert into kpi_snapshots (org_id, snapshot_date, metric, value)
    select p_org, today, 'episodes_open',
           count(*)::numeric
    from episodes where org_id = p_org and status = 'open'
  on conflict (org_id, snapshot_date, metric) do update set value = excluded.value;
  inserted := inserted + 1;

  -- KPI 2: camas ocupadas
  begin
    insert into kpi_snapshots (org_id, snapshot_date, metric, value)
      select p_org, today, 'beds_occupied',
             count(*)::numeric
      from beds where org_id = p_org and status = 'occupied' and active = true
    on conflict (org_id, snapshot_date, metric) do update set value = excluded.value;
    inserted := inserted + 1;
  exception when undefined_table then null; end;

  -- KPI 3: triagens pendentes
  begin
    insert into kpi_snapshots (org_id, snapshot_date, metric, value)
      select p_org, today, 'triage_pending',
             count(*)::numeric
      from triage_assessments where org_id = p_org and seen_at is null
    on conflict (org_id, snapshot_date, metric) do update set value = excluded.value;
    inserted := inserted + 1;
  exception when undefined_table then null; end;

  -- KPI 4: encomendas pendentes
  begin
    insert into kpi_snapshots (org_id, snapshot_date, metric, value)
      select p_org, today, 'purchase_orders_open',
             count(*)::numeric
      from purchase_orders where org_id = p_org and status in ('sent','partial')
    on conflict (org_id, snapshot_date, metric) do update set value = excluded.value;
    inserted := inserted + 1;
  exception when undefined_table then null; end;

  -- KPI 5: tarefas de agente abertas
  begin
    insert into kpi_snapshots (org_id, snapshot_date, metric, value)
      select p_org, today, 'agent_tasks_open',
             count(*)::numeric
      from agent_tasks where org_id = p_org and status = 'open'
    on conflict (org_id, snapshot_date, metric) do update set value = excluded.value;
    inserted := inserted + 1;
  exception when undefined_table then null; end;

  return inserted;
end;
$$;
