-- sprint104_attendance.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RONDA 12 — Presenças do dia (centro de dia / lar).
-- Regista quem ESTÁ presente hoje. No centro de dia isto é o coração do serviço:
-- chegada, saída e "está cá". Antes o painel inferia presença só do care-log, o
-- que era frágil (dar medicação não contava) e não deixava marcar à mão.
-- Uma linha por utente/dia. Org-scoped (sprint91/97), com quem marcou.
-- 2026-07-05.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists attendance (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete set null,
  recorded_by_id uuid references auth.users(id),
  patient_id  uuid not null references patients(id) on delete cascade,
  date        date not null default current_date,
  status      text not null default 'present' check (status in ('present','absent','left')),
  arrived_at  timestamptz,
  left_at     timestamptz,
  transport   text,                       -- ex.: "carrinha", "família", "táxi"
  note        text,
  created_at  timestamptz not null default now()
);
-- Uma marcação por utente por dia (upsert por (patient_id,date)).
create unique index if not exists attendance_pt_day_uidx on attendance (patient_id, date);
create index if not exists attendance_org_day_idx on attendance (org_id, date) where org_id is not null;

-- ─── RLS — próprio (user_id) OU membro da org (sprint91/97 pattern) ──────────
alter table attendance enable row level security;
do $$ begin
  create policy "att_own" on attendance for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "att_org_access" on attendance for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table attendance; exception when others then null; end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Vigia Clínico (/vigia): passar de por-utilizador para por-ORGANIZAÇÃO.
-- Antes o /api/vigilancia lia patient_vigilance só por user_id → uma equipa não
-- via os residentes/resultados uns dos outros ("não associa residentes").
-- Acrescentamos org_id + política de leitura/escrita para membros da org.
-- ─────────────────────────────────────────────────────────────────────────────
alter table if exists patient_vigilance add column if not exists org_id uuid references organizations(id) on delete set null;
create index if not exists pv_org_idx on patient_vigilance (org_id) where org_id is not null;

do $$ begin
  create policy "pv_org_access" on patient_vigilance for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Movimentos financeiros (/faturacao): despesas e OUTRAS receitas além das
-- mensalidades. Dá ao dono o resultado do mês (mensalidades + outras receitas −
-- despesas). Org-scoped, com quem registou.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists finance_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete set null,
  recorded_by_id uuid references auth.users(id),
  kind        text not null check (kind in ('expense','income')),  -- despesa | outra receita
  category    text,                       -- ex.: "salários", "alimentação", "donativo"
  description text not null,
  amount      numeric not null default 0, -- sempre positivo; kind dá o sinal
  date        date not null default current_date,
  method      text,
  created_at  timestamptz not null default now()
);
create index if not exists finance_org_date_idx on finance_entries (org_id, date desc) where org_id is not null;
create index if not exists finance_user_date_idx on finance_entries (user_id, date desc);

alter table finance_entries enable row level security;
do $$ begin
  create policy "fin_own" on finance_entries for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "fin_org_access" on finance_entries for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table finance_entries; exception when others then null; end $$;
