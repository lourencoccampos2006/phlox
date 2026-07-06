-- sprint107_rounds.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RONDA 13 — Rondas coordenadas (lar / centro de dia).
-- Uma ronda pode ser feita por VÁRIOS funcionários ao mesmo tempo. Os utentes
-- são divididos entre eles (cada um aparece a UM só). Se um funcionário atender
-- um utente que estava atribuído a outro, o utente é TRANSFERIDO para quem
-- realmente o atendeu. Tudo fica registado (quem, quando, estado, nota).
-- Org-scoped (sprint91/97). 2026-07-05.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists rounds (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid references organizations(id) on delete set null,
  date         date not null default current_date,
  shift        text,                       -- manha/tarde/noite
  participants jsonb not null default '[]'::jsonb,  -- [{ id, name }]
  status       text not null default 'active' check (status in ('active','done')),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  ended_at     timestamptz
);
create index if not exists rounds_org_idx on rounds (org_id, created_at desc) where org_id is not null;

create table if not exists round_assignments (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references rounds(id) on delete cascade,
  org_id       uuid references organizations(id) on delete set null,
  patient_id   uuid not null references patients(id) on delete cascade,
  assigned_to  uuid references auth.users(id),      -- funcionário a quem calhou
  assigned_name text,
  status       text not null default 'pending' check (status in ('pending','done','skipped')),
  attended_by  uuid references auth.users(id),      -- quem REALMENTE atendeu
  attended_name text,
  outcome      text,                                 -- estavel/vigiar/alerta
  note         text,
  updated_at   timestamptz not null default now()
);
create unique index if not exists ra_round_patient_uidx on round_assignments (round_id, patient_id);
create index if not exists ra_round_idx on round_assignments (round_id);

alter table rounds enable row level security;
alter table round_assignments enable row level security;
do $$ begin
  create policy "rounds_own" on rounds for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "rounds_org" on rounds for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "ra_org" on round_assignments for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;
-- fallback próprio (contas solo sem org): permite quando a ronda é do próprio
do $$ begin
  create policy "ra_own" on round_assignments for all
    using (round_id in (select id from rounds where user_id = auth.uid()))
    with check (round_id in (select id from rounds where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table rounds; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table round_assignments; exception when others then null; end $$;
