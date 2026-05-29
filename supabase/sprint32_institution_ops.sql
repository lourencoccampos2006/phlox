-- sprint32_institution_ops.sql
-- Ecossistema institucional: sala de espera (walk-ins sem conta), tarefas da equipa
-- (todas as funções), e conformidade/auditoria por tipo de instituição.
-- Todas as tabelas com RLS user_id = auth.uid().

-- ─── Sala de espera / fila (doentes que só passam lá, sem conta Phlox) ──────────
create table if not exists waiting_room (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  reason      text,
  priority    text not null default 'normal' check (priority in ('urgente','prioritario','normal')),
  status      text not null default 'waiting' check (status in ('waiting','called','in_service','done','left')),
  patient_id  uuid,                       -- ligação opcional a ficha existente
  professional text,
  arrived_at  timestamptz not null default now(),
  called_at   timestamptz,
  done_at     timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists waiting_room_user_idx on waiting_room(user_id, status, arrived_at);
alter table waiting_room enable row level security;
do $$ begin create policy "waiting_room_own" on waiting_room for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ─── Tarefas da equipa (da secretaria à limpeza, manutenção, clínica) ───────────
create table if not exists team_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  area        text not null default 'geral',  -- clinica | limpeza | manutencao | secretaria | cozinha | farmacia | geral
  assignee    text,                            -- nome livre (ou membro da equipa)
  priority    text not null default 'normal' check (priority in ('alta','normal','baixa')),
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  due_date    date,
  recurring   text,                            -- ex: "diária", "semanal" (texto livre)
  done_at     timestamptz,
  done_by     text,
  created_at  timestamptz not null default now()
);
create index if not exists team_tasks_user_idx on team_tasks(user_id, status, area);
alter table team_tasks enable row level security;
do $$ begin create policy "team_tasks_own" on team_tasks for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ─── Conformidade / auditoria (estado dos itens obrigatórios) ───────────────────
create table if not exists compliance_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  key           text not null,               -- identificador do item do checklist
  institution   text not null,               -- tipo de instituição no momento do registo
  status        text not null default 'pending' check (status in ('done','pending','na')),
  note          text,
  evidence_url  text,
  reviewed_at   timestamptz,
  reviewed_by   text,
  updated_at    timestamptz not null default now(),
  unique (user_id, key)
);
alter table compliance_items enable row level security;
do $$ begin create policy "compliance_items_own" on compliance_items for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ─── Consentimentos emitidos (RGPD / procedimentos) ─────────────────────────────
create table if not exists consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  person_name text not null,
  kind        text not null default 'rgpd',  -- chave do modelo de consentimento
  institution text,
  body        text,                           -- texto final do consentimento
  signed      boolean not null default false,
  signed_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists consents_user_idx on consents(user_id, created_at);
alter table consents enable row level security;
do $$ begin create policy "consents_own" on consents for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ─── Stock & validades ──────────────────────────────────────────────────────────
-- NOTA: a tabela `stock_items` já existe (sprint21_stock.sql) com a coluna `expiry_date`.
-- Aqui apenas garantimos que a tabela existe e que tem as colunas usadas pela página,
-- de forma idempotente (sem recriar nem entrar em conflito com a definição anterior).
create table if not exists stock_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  name        text not null,
  category    text default 'medicamento',
  quantity    numeric not null default 0,
  unit        text default 'un',
  min_quantity numeric default 0,
  expiry_date date,
  location    text,
  notes       text,
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);
alter table stock_items add column if not exists category     text default 'medicamento';
alter table stock_items add column if not exists min_quantity  numeric default 0;
alter table stock_items add column if not exists unit          text default 'un';
alter table stock_items add column if not exists expiry_date   date;
alter table stock_items add column if not exists location      text;
alter table stock_items add column if not exists updated_at    timestamptz default now();
-- A definição antiga (sprint21) limitava `category` a um conjunto fixo; removemos o CHECK
-- para permitir as novas categorias (consumivel, epi, limpeza, geral) sem conflito.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'stock_items_category_check') then
    alter table stock_items drop constraint stock_items_category_check;
  end if;
end $$;
alter table stock_items enable row level security;
do $$ begin create policy "stock_items_own" on stock_items for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
create index if not exists stock_items_user_idx on stock_items(user_id, expiry_date);
