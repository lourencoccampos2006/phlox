-- sprint78_exam_mode.sql
-- Phlox — Modo Exame (Plus). O estudante define um exame com DATA + tópicos.
-- O Phlox gera um plano com contagem decrescente que se reajusta ao desempenho
-- e entra em "modo sprint" nos últimos dias. Orquestra estudo para um objetivo
-- com prazo.
--
-- 2026-06-05. Idempotente.

create table if not exists exam_goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,             -- ex: "Exame de Farmacologia"
  exam_date    date not null,
  topics       text[] not null default '{}',
  daily_minutes int default 60,
  -- plano gerado: array de dias { date, focus[], tasks[], type }
  plan         jsonb not null default '[]'::jsonb,
  -- progresso: mapa topic -> confiança 0..1 (ajusta o plano)
  confidence   jsonb not null default '{}'::jsonb,
  status       text not null default 'active',  -- active | done | archived
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists exam_goals_user_idx on exam_goals(user_id, exam_date);

alter table exam_goals enable row level security;
do $$ begin
  create policy "exam_goals_own" on exam_goals for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Toca updated_at
drop trigger if exists exam_goals_touch on exam_goals;
do $$ begin
  create trigger exam_goals_touch before update on exam_goals
    for each row execute procedure set_updated_at();
exception when undefined_function then null; end $$;

-- RPC para criar (bypassa eventual cache de schema do PostgREST)
create or replace function create_exam_goal(
  p_name text, p_exam_date date, p_topics text[], p_daily int, p_plan jsonb
) returns exam_goals
language plpgsql security definer set search_path = public as $$
declare r exam_goals;
begin
  insert into exam_goals (user_id, name, exam_date, topics, daily_minutes, plan)
  values (auth.uid(), p_name, p_exam_date, coalesce(p_topics,'{}'), coalesce(p_daily,60), coalesce(p_plan,'[]'::jsonb))
  returning * into r;
  return r;
end;
$$;
grant execute on function create_exam_goal(text, date, text[], int, jsonb) to authenticated;
