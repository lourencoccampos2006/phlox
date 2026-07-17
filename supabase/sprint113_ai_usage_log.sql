-- sprint113_ai_usage_log.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- MELHORIAS 2026-07-17 (item D17) — orçamento de custo de IA por utilizador.
-- Só service-role escreve/lê (lib/aiUsage.ts) — sem policy pública de
-- propósito, RLS ativa por defeito nega tudo a quem não seja service-role.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ai_usage_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  feature    text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_log_user_month_idx on ai_usage_log (user_id, created_at desc);

alter table ai_usage_log enable row level security;
