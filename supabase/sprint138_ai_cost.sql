-- sprint138_ai_cost.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- O /admin mostrava 0 € de IA depois de gerares duas ementas inteiras. A razão:
-- 101 rotas do produto chamam a IA e só QUATRO registavam consumo. O
-- ai_usage_log também não guardava modelo nem tokens, por isso mesmo essas
-- quatro não davam para calcular custo nenhum — só contagem de chamadas.
--
-- A partir daqui o registo é feito em lib/ai.ts, no aiComplete, por onde TODAS
-- as chamadas passam. Uma alteração em vez de 101, e nenhuma rota nova fica
-- esquecida.
--
-- `user_id` passa a poder ser nulo: há chamadas de fundo (crons, webhooks) que
-- não têm utilizador, e perder o custo delas era pior do que não saber de quem
-- foram.
--
-- Seguro de correr mais do que uma vez.
-- ─────────────────────────────────────────────────────────────────────────────

alter table ai_usage_log add column if not exists provider    text;
alter table ai_usage_log add column if not exists model       text;
alter table ai_usage_log add column if not exists tokens_in   integer;
alter table ai_usage_log add column if not exists tokens_out  integer;
alter table ai_usage_log add column if not exists cost_usd    numeric(10, 6);
alter table ai_usage_log add column if not exists ms          integer;
alter table ai_usage_log add column if not exists ok          boolean not null default true;

-- Chamadas sem utilizador (cron, webhook) têm de caber.
do $$ begin
  alter table ai_usage_log alter column user_id drop not null;
exception when others then null; end $$;

create index if not exists ai_usage_log_mes_idx on ai_usage_log (created_at desc);
create index if not exists ai_usage_log_feat_idx on ai_usage_log (feature, created_at desc);

notify pgrst, 'reload schema';
