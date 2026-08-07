-- sprint126_support_transport_schedules.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: PRECISAS DE CORRER ISTO TU MESMO NO SUPABASE (SQL EDITOR).
-- Não apliquei — não toco no Supabase sem pedires (ver memória do projeto).
--
-- Reconstrução de /apoio-servicos, pedida na auditoria: a versão anterior
-- (sprint122 support_services) era só um quadro de pedidos avulsos — não
-- ajudava a ORGANIZAR transportes que se repetem todas as semanas (ex: "a Dona
-- Maria vai à fisioterapia toda terça e quinta"). Isso é DIFERENTE do
-- transporte já coberto em /agenda (que é por MARCAÇÃO datada, uma vez) — aqui
-- é um horário fixo que se repete.
--
-- Mesmo padrão (tabelas E políticas de RLS) já usado em
-- care_checklists/care_checklist_logs (sprint123): uma tabela para o "plano"
-- (o quê, quando) e outra para o "feito hoje" — copiado linha a linha, para
-- não inventar um padrão de RLS novo à mão.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists support_transport_schedules (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete set null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  label           text not null,   -- "Transporte para fisioterapia", "Recolha ao domicílio"
  weekdays        integer[],       -- null = todos os dias; senão 0(domingo)-6(sábado)
  time            text,            -- "09:30", opcional
  notes           text,
  active          boolean not null default true,
  recorded_by_id  uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index if not exists support_transport_schedules_patient_idx on support_transport_schedules (patient_id, active);
create index if not exists support_transport_schedules_org_idx on support_transport_schedules (org_id);

alter table support_transport_schedules enable row level security;

do $$ begin
  create policy "support_transport_schedules_own" on support_transport_schedules for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "support_transport_schedules_org_access" on support_transport_schedules for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin
  execute $p$create policy "support_transport_schedules_ins_noviewer" on support_transport_schedules as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_transport_schedules_upd_noviewer" on support_transport_schedules as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_transport_schedules_del_noviewer" on support_transport_schedules as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

-- ── Logs diários (feito/não feito) ───────────────────────────────────────────
create table if not exists support_transport_logs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations(id) on delete set null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  schedule_id   uuid not null references support_transport_schedules(id) on delete cascade,
  patient_id    uuid not null references patients(id) on delete cascade,
  date          date not null,
  done          boolean not null default false,
  done_by_id    uuid references auth.users(id),
  done_at       timestamptz,
  recorded_by_id uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  unique (schedule_id, date)
);
create index if not exists support_transport_logs_patient_idx on support_transport_logs (patient_id, date);
create index if not exists support_transport_logs_org_idx on support_transport_logs (org_id);

alter table support_transport_logs enable row level security;

do $$ begin
  create policy "support_transport_logs_own" on support_transport_logs for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "support_transport_logs_org_access" on support_transport_logs for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin
  execute $p$create policy "support_transport_logs_ins_noviewer" on support_transport_logs as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_transport_logs_upd_noviewer" on support_transport_logs as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_transport_logs_del_noviewer" on support_transport_logs as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

notify pgrst, 'reload schema';
