-- sprint108_recurring_activities.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RONDA 5 — Atividades recorrentes ("todas as quartas às 10h ginástica" fica
-- sempre agendada, sem a equipa ter de recriar a atividade todas as semanas).
-- Um modelo recorrente (recurring_activities) gera ocorrências reais em
-- `activities` (a app garante as próximas ocorrências ao carregar /activities;
-- `recurring_id` liga a ocorrência de volta ao modelo e evita duplicar).
-- Org-scoped (sprint91/97), mesmo padrão do sprint107. 2026-07-09.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists recurring_activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  org_id           uuid references organizations(id) on delete set null,
  title            text not null,
  type             text not null default 'other',
  weekday          int not null check (weekday between 0 and 6),  -- 0=domingo … 6=sábado (Date.getDay())
  start_time       text not null,
  end_time         text,
  location         text,
  responsible      text,
  description      text,
  max_participants int,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists recurring_activities_org_idx on recurring_activities (org_id) where org_id is not null;

alter table recurring_activities enable row level security;
do $$ begin
  create policy "recurring_activities_own" on recurring_activities for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "recurring_activities_org" on recurring_activities for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

-- Liga uma ocorrência gerada de volta ao modelo que a criou.
alter table activities add column if not exists recurring_id uuid references recurring_activities(id) on delete set null;
create index if not exists activities_recurring_idx on activities (recurring_id, date) where recurring_id is not null;

do $$ begin alter publication supabase_realtime add table recurring_activities; exception when others then null; end $$;
