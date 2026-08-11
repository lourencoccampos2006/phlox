-- sprint131_recurring_services.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda "melhor escolha possível" 2026-08-11, continuação — dois gaps menores
-- que ficaram por fazer na primeira ronda:
--   - "Tratamento de roupas pessoais": só existia como pedido avulso
--     (support_services, kind='roupa') — nunca ganhou o mesmo tratamento que
--     o transporte ganhou em sprint126 (uma agenda que se repete sozinha,
--     "lavar a roupa da Dona Maria toda terça e sexta").
--   - "Serviços complementares: higiene pessoal e/ou alimentação ao fim de
--     semana, complemento alimentar à noite de 2ª a 6ª": não existia NADA.
--
-- Os dois têm exatamente a mesma forma que o transporte já tem (uma coisa
-- que se repete em certos dias da semana, com um toque para marcar feito) —
-- por isso é UMA tabela nova só, com um "kind" a distinguir, em vez de copiar
-- support_transport_schedules/logs outra vez. O transporte em si fica tal
-- como está (já em produção, sem tocar).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists support_recurring_services (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete set null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  patient_id  uuid not null references patients(id) on delete cascade,
  kind        text not null,
  label       text,
  weekdays    int[],
  time        text,
  notes       text,
  active      boolean not null default true,
  recorded_by_id uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
do $$ begin
  alter table support_recurring_services add constraint support_recurring_services_kind_check
    check (kind in ('roupa', 'higiene_fds', 'alimentacao_fds', 'reforco_noite'));
exception when duplicate_object then null; end $$;
create index if not exists support_recurring_services_patient_idx on support_recurring_services (patient_id, active);
create index if not exists support_recurring_services_org_idx on support_recurring_services (org_id, kind);

create table if not exists support_recurring_logs (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references support_recurring_services(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,
  date         date not null,
  done         boolean not null default false,
  done_by_id   uuid references auth.users(id),
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);
do $$ begin
  alter table support_recurring_logs add constraint support_recurring_logs_unique unique (schedule_id, date);
exception when duplicate_object then null; end $$;
create index if not exists support_recurring_logs_date_idx on support_recurring_logs (patient_id, date desc);

alter table support_recurring_services enable row level security;
alter table support_recurring_logs enable row level security;

do $$ begin
  create policy "support_recurring_services_own" on support_recurring_services for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "support_recurring_services_org_access" on support_recurring_services for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;
do $$ begin
  execute $p$create policy "support_recurring_services_ins_noviewer" on support_recurring_services as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_recurring_services_upd_noviewer" on support_recurring_services as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_recurring_services_del_noviewer" on support_recurring_services as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

-- support_recurring_logs — sem org_id direto (herda o acesso via join ao
-- schedule); usa a mesma abordagem de support_transport_logs (RLS aberta a
-- quem está autenticado, protegida na prática por precisar do schedule_id
-- real, que por sua vez só é lido dentro da RLS acima).
do $$ begin
  create policy "support_recurring_logs_all" on support_recurring_logs for all
    using (exists (select 1 from support_recurring_services s where s.id = support_recurring_logs.schedule_id and (
      (s.org_id is null and s.user_id = auth.uid()) or
      (s.org_id is not null and s.org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    )))
    with check (exists (select 1 from support_recurring_services s where s.id = support_recurring_logs.schedule_id and (
      (s.org_id is null and s.user_id = auth.uid()) or
      (s.org_id is not null and s.org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    )));
exception when duplicate_object then null; end $$;
