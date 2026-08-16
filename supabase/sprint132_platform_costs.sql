-- sprint132_platform_costs.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: PRECISAS DE CORRER ISTO TU MESMO NO SUPABASE (SQL EDITOR).
-- Não apliquei — não toco no Supabase sem pedires (ver memória do projeto).
--
-- Custos fixos que não têm API para consultar automaticamente (hosting,
-- domínio, Supabase, outras subscrições) — editáveis no novo painel /admin,
-- separador "Financeiro". Nunca lido por um cliente normal (só a rota
-- /api/admin/costs, com service role) — sem RLS aberta de propósito, é uma
-- tabela interna só tua.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists platform_costs (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  amount_monthly numeric not null default 0,
  note         text,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

alter table platform_costs enable row level security;
-- Sem policies de propósito — só o service role (usado pelas rotas /api/admin/*)
-- consegue ler/escrever. RLS ligada bloqueia anon/authenticated por omissão.

notify pgrst, 'reload schema';
