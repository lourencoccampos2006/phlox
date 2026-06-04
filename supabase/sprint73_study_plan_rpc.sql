-- sprint73_study_plan_rpc.sql
-- Phlox — RPC para criar plano de estudo bypassando schema cache do PostgREST.
--
-- Causa: a tabela study_plans foi criada por sprint70 mas o PostgREST mantém
-- o cache desactualizado. O REST devolve "Could not find the 'name' column".
-- A RPC é SECURITY DEFINER e usa SQL directo (que NÃO passa pelo cache REST),
-- por isso funciona independentemente do estado do cache.
--
-- Esta migração também garante que TODAS as colunas existem.
--
-- 2026-06-04. Idempotente.

-- ─── 1) Garante todas as colunas de study_plans ─────────────────────────
do $$ begin
  perform 1 from information_schema.tables where table_schema='public' and table_name='study_plans';
  if not found then return; end if;
  alter table study_plans add column if not exists name text;
  alter table study_plans add column if not exists goal text;
  alter table study_plans add column if not exists weeks int default 12;
  alter table study_plans add column if not exists hours_per_week int default 15;
  alter table study_plans add column if not exists domains text[];
  alter table study_plans add column if not exists status text default 'active';
  alter table study_plans add column if not exists schedule jsonb;
  alter table study_plans add column if not exists current_week int default 1;
  alter table study_plans add column if not exists created_at timestamptz default now();
  alter table study_plans add column if not exists updated_at timestamptz default now();
end $$;

-- ─── 2) RPC create_study_plan ───────────────────────────────────────────
create or replace function create_study_plan(
  p_name           text,
  p_goal           text default null,
  p_weeks          int  default 12,
  p_hours_per_week int  default 15,
  p_domains        text[] default '{}'::text[],
  p_schedule       jsonb default '[]'::jsonb
) returns study_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plan study_plans;
begin
  if v_user is null then
    raise exception 'Não autenticado.';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'O nome do plano é obrigatório.';
  end if;

  insert into study_plans (
    user_id, name, goal, weeks, hours_per_week, domains, schedule, status, current_week
  ) values (
    v_user, trim(p_name), p_goal, coalesce(p_weeks, 12), coalesce(p_hours_per_week, 15),
    coalesce(p_domains, '{}'::text[]), coalesce(p_schedule, '[]'::jsonb), 'active', 1
  )
  returning * into v_plan;

  return v_plan;
end;
$$;

grant execute on function create_study_plan(text, text, int, int, text[], jsonb) to authenticated;

-- ─── 3) Força reload do schema do PostgREST ─────────────────────────────
notify pgrst, 'reload schema';
