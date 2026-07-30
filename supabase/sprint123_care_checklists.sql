-- sprint123_care_checklists.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda "centro de dia real" 2026-07-30 (cont.) — Fernando: fortalecer
-- "cuidados básicos/enfermagem" com ESTRUTURA, não só registo pontual.
-- health_checkins (sprint122) cobre "aconteceu isto hoje, sem mais contexto".
-- Falta o outro lado: tarefas de cuidado PLANEADAS e recorrentes por pessoa
-- ("banho às terças e sextas", "mobilização todos os dias") que a equipa
-- risca à medida que faz — mesmo espírito de recurring_activities→activities
-- (sprint108), mas para cuidados, não atividades de grupo.
--
-- care_checklists = o PLANO (a tarefa recorrente em si, por pessoa).
-- care_checklist_logs = uma linha por (tarefa, dia) — feito ou não, por quem.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists care_checklists (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete set null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  title           text not null,
  weekdays        integer[],  -- null = todos os dias; senão 0(domingo)-6(sábado)
  active          boolean not null default true,
  recorded_by_id  uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index if not exists care_checklists_patient_idx on care_checklists (patient_id, active);
create index if not exists care_checklists_org_idx on care_checklists (org_id);

alter table care_checklists enable row level security;

do $$ begin
  create policy "care_checklists_own" on care_checklists for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "care_checklists_org_access" on care_checklists for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin
  execute $p$create policy "care_checklists_ins_noviewer" on care_checklists as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "care_checklists_upd_noviewer" on care_checklists as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "care_checklists_del_noviewer" on care_checklists as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

-- ── Logs diários (feito/não feito) ───────────────────────────────────────────
create table if not exists care_checklist_logs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations(id) on delete set null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  checklist_id  uuid not null references care_checklists(id) on delete cascade,
  patient_id    uuid not null references patients(id) on delete cascade,
  date          date not null,
  done          boolean not null default false,
  done_by_id    uuid references auth.users(id),
  done_at       timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (checklist_id, date)
);
create index if not exists care_checklist_logs_patient_idx on care_checklist_logs (patient_id, date);
create index if not exists care_checklist_logs_org_idx on care_checklist_logs (org_id);

alter table care_checklist_logs enable row level security;

do $$ begin
  create policy "care_checklist_logs_own" on care_checklist_logs for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "care_checklist_logs_org_access" on care_checklist_logs for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin
  execute $p$create policy "care_checklist_logs_ins_noviewer" on care_checklist_logs as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "care_checklist_logs_upd_noviewer" on care_checklist_logs as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "care_checklist_logs_del_noviewer" on care_checklist_logs as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
