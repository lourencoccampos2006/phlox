-- sprint122_health_checkins_support_services.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda "centro de dia real" 2026-07-30 — Fernando: o site está pesado em
-- medicação, mas um centro de dia vive de refeições, ginástica/fisioterapia,
-- acompanhamento básico de saúde/enfermagem, atividades de estimulação e
-- serviços de apoio (roupa, transporte) — coisas que hoje quase não têm
-- registo nenhum no Phlox. Levantamento confirmou:
--   - Refeições: já há dados (care_records.nutrition) mas nenhuma página
--     dedicada — não precisa de esquema novo, só de UI própria.
--   - Ginástica/Fisioterapia/jogos/ateliers/passeios: já bem cobertos por
--     activities+activity_participations (recorrentes incluído) — não
--     precisa de esquema novo, só de melhor visibilidade + rota de voz.
--   - Enfermagem básica / acompanhamento de saúde: GAP CONFIRMADO. Não é uma
--     atividade agendada de grupo (não cabe em `activities`) nem precisa do
--     fluxo pesado de "ronda coordenada" (`rounds`/`round_assignments`, que
--     exige uma ronda-mãe com turno/participantes) — é um registo pontual,
--     por utente, "hoje acompanhei a Dona Maria, estava bem". Tabela nova,
--     leve, isolada.
--   - Serviços de apoio (roupa/transporte): GAP CONFIRMADO, nada existia.
--     Tabela nova, leve, com fluxo pedido→em curso→concluído (mesmo espírito
--     do quadro "Preciso de ajuda" já usado em family_help_requests).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists health_checkins (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete set null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  kind            text not null default 'acompanhamento',
  date            date not null default current_date,
  notes           text not null,
  duration_min    integer,
  recorded_by_id  uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index if not exists health_checkins_patient_idx on health_checkins (patient_id, date desc);
create index if not exists health_checkins_org_idx on health_checkins (org_id);

do $$ begin
  alter table health_checkins add constraint health_checkins_kind_check check (kind in ('enfermagem', 'acompanhamento'));
exception when duplicate_object then null; end $$;

alter table health_checkins enable row level security;

do $$ begin
  create policy "health_checkins_own" on health_checkins for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "health_checkins_org_access" on health_checkins for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

-- Viewers (só-leitura) não podem escrever, tal como o resto da plataforma.
do $$ begin
  execute $p$create policy "health_checkins_ins_noviewer" on health_checkins as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "health_checkins_upd_noviewer" on health_checkins as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "health_checkins_del_noviewer" on health_checkins as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

-- ── Serviços de apoio (roupa, transporte, outro) ─────────────────────────────
create table if not exists support_services (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations(id) on delete set null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  patient_id       uuid references patients(id) on delete cascade,
  kind             text not null default 'outro',
  date             date not null default current_date,
  status           text not null default 'pedido',
  notes            text,
  requested_by_id  uuid references auth.users(id),
  completed_by_id  uuid references auth.users(id),
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists support_services_patient_idx on support_services (patient_id, date desc);
create index if not exists support_services_org_idx on support_services (org_id, status);

do $$ begin
  alter table support_services add constraint support_services_kind_check check (kind in ('roupa', 'transporte', 'outro'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table support_services add constraint support_services_status_check check (status in ('pedido', 'em_curso', 'concluido'));
exception when duplicate_object then null; end $$;

alter table support_services enable row level security;

do $$ begin
  create policy "support_services_own" on support_services for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "support_services_org_access" on support_services for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin
  execute $p$create policy "support_services_ins_noviewer" on support_services as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_services_upd_noviewer" on support_services as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_services_del_noviewer" on support_services as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
