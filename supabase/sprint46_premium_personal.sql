-- sprint46_premium_personal.sql
-- Phlox — Funcionalidades premium do plano PESSOAL.
-- Inclui:
--   • Health Vault — documentos clínicos com partilha por código temporário
--   • Lab tendências — tabela longitudinal de análises (valor + data)
--   • Refill — projeção de quando vai ficar sem comprimidos
--   • Med log — registo de toma confirmada para heatmap de adesão

-- ── Health Vault ────────────────────────────────────────────────────────────
create table if not exists health_vault (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  category     text not null check (category in ('exam','prescription','imaging','vaccine','report','letter','other')),
  notes        text,
  body_text    text,                                  -- texto extraído ou colado
  body_url     text,                                  -- opcional: URL externo (S3, Storage)
  issued_at    date,
  expires_at   date,                                  -- ex: receita
  tags         text[],
  pinned       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists health_vault_user_idx on health_vault(user_id, updated_at desc);
alter table health_vault enable row level security;
do $$ begin
  create policy "health_vault_own" on health_vault for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Share codes — link temporário para mostrar 1+ documentos a um terceiro sem login
create table if not exists health_vault_shares (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  code         text not null unique,                  -- 8 chars human-readable
  vault_ids    uuid[] not null,
  expires_at   timestamptz not null,
  views        int not null default 0,
  max_views    int not null default 10,
  created_at   timestamptz not null default now()
);

-- CORREÇÃO 1: Remoção do predicado imutável "where expires_at > now()" para evitar o erro 42P17
create index if not exists health_vault_shares_code_idx on health_vault_shares(code);

alter table health_vault_shares enable row level security;
do $$ begin
  create policy "health_vault_shares_own" on health_vault_shares for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── Lab tendências ──────────────────────────────────────────────────────────
create table if not exists lab_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  test_code    text not null,                         -- ex: 'hba1c', 'tsh', 'ldl'
  test_label   text not null,
  value        numeric not null,
  unit         text not null,
  ref_low      numeric,
  ref_high     numeric,
  measured_at  date not null,
  source       text,                                  -- 'manual', 'vault:<id>', 'apple-health'
  created_at   timestamptz not null default now()
);
create index if not exists lab_results_user_idx on lab_results(user_id, test_code, measured_at desc);
alter table lab_results enable row level security;
do $$ begin
  create policy "lab_results_own" on lab_results for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── Refill estimate — adiciona colunas ao personal_meds se já existe ───────
-- Em vez de tabela nova, expandimos personal_meds com estoque e per_day.
-- (Drop-safe: usa do block para evitar erro se coluna já existe)
do $$ begin
  alter table personal_meds add column if not exists pills_remaining int;
  alter table personal_meds add column if not exists pills_per_day numeric;
exception when undefined_table then null; end $$;

-- ── Adesão heatmap ──────────────────────────────────────────────────────────
-- Reaproveita med_logs se existe. Se não existir, cria.
create table if not exists med_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  med_id       uuid,
  med_name     text,
  taken_at     timestamptz not null default now(),
  status       text not null default 'taken' check (status in ('taken','skipped','late')),
  notes        text
);

-- CORREÇÃO 2: Garante que as colunas existem caso a tabela med_logs já exista para evitar o erro 42703
do $$ begin
  alter table med_logs add column if not exists med_id uuid;
  alter table med_logs add column if not exists med_name text;
  alter table med_logs add column if not exists taken_at timestamptz not null default now();
  alter table med_logs add column if not exists status text not null default 'taken' check (status in ('taken','skipped','late'));
  alter table med_logs add column if not exists notes text;
exception when undefined_table then null; end $$;

create index if not exists med_logs_user_idx on med_logs(user_id, taken_at desc);
alter table med_logs enable row level security;
do $$ begin
  create policy "med_logs_own" on med_logs for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;