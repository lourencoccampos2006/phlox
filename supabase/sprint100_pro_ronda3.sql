-- sprint100_pro_ronda3.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- PRO RONDA 3 — Objetivo de Saúde (espinha de personalização) + Índice de
-- Risco Contínuo (self + familiar). 2026-07-15.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Objetivo de Saúde: o motivo real do Pro estar no Phlox. Reconfigura o que
--    lhe mostramos (planos, funcionalidades). Escolhido em /settings, editável.
alter table profiles add column if not exists health_goal text
  check (health_goal in ('lose_weight','manage_chronic','caregiving','recover','wellness'));
alter table profiles add column if not exists health_goal_detail text; -- ex: nome da doença crónica, texto livre

-- 2) Índice de Risco Contínuo — snapshot diário (self OU familiar), calculado
--    ao ver a página (sem cron): 1 linha por (dono, perfil, dia). profile_id
--    null = o próprio utilizador; profile_id set = um family_profiles.id.
create table if not exists risk_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid references family_profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  score         integer not null check (score between 0 and 100),
  level         text not null check (level in ('critical','warning','info','ok')),
  top_factors   jsonb not null default '[]'::jsonb,   -- [{title, severity}] resumo do dia
  created_at    timestamptz not null default now()
);
create unique index if not exists risk_snapshots_dedup on risk_snapshots
  (user_id, coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid), snapshot_date);
create index if not exists risk_snapshots_lookup on risk_snapshots (user_id, profile_id, snapshot_date desc);

alter table risk_snapshots enable row level security;
do $$ begin create policy "rs_own" on risk_snapshots for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
