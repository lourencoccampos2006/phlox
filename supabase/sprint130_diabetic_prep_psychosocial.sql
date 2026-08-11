-- sprint130_diabetic_prep_psychosocial.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda "melhor escolha possível" 2026-08-11 — auditoria direta contra a lista
-- de serviços de um centro de dia real (o Fernando vai apresentar-lhes o
-- Phlox). Três gaps confirmados por leitura de código, não suposição:
--   - "reforço alimentar aos idosos diabéticos": /refeicoes só tinha uma tag
--     de dieta num PRATO — nada ao nível do residente, nada a registar se o
--     reforço foi de facto dado. Tabela nova, leve, por residente/dia/turno.
--   - "preparação em unidoses": /mar já cobre a TOMA (dar o medicamento) com
--     grau de auditoria alto — mas preparar o pastilheiro da semana é um ato
--     físico distinto, nunca registado em lado nenhum. Grelha dia×turno por
--     residente/semana, o mesmo espírito de app/care-log/CuidadosTool.tsx.
--   - "apoio psico-social + encaminhamento a especialistas": inexistente por
--     completo — sem tabela, sem página, sem nada. Nota + encaminhamento
--     opcional (para quem, estado), SÓ VISÍVEL À EQUIPA (decisão do
--     Fernando 2026-08-11: dados sensíveis, começar interno).
-- Mesmo padrão de RLS de sprint122 (health_checkins/support_services): dono
-- sem org vê só o seu; com org, toda a equipa ativa vê; viewers não escrevem.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Reforço alimentar (diabéticos, extensível a outras dietas no futuro) ─────
create table if not exists dietary_reinforcements (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations(id) on delete set null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  date             date not null default current_date,
  shift            text not null default 'manha',
  given            boolean not null default false,
  notes            text,
  recorded_by_id   uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
do $$ begin
  alter table dietary_reinforcements add constraint dietary_reinforcements_shift_check check (shift in ('manha', 'tarde', 'noite'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table dietary_reinforcements add constraint dietary_reinforcements_unique unique (patient_id, date, shift);
exception when duplicate_object then null; end $$;
create index if not exists dietary_reinforcements_patient_idx on dietary_reinforcements (patient_id, date desc);
create index if not exists dietary_reinforcements_org_idx on dietary_reinforcements (org_id, date);

alter table dietary_reinforcements enable row level security;
do $$ begin
  create policy "dietary_reinforcements_own" on dietary_reinforcements for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "dietary_reinforcements_org_access" on dietary_reinforcements for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;
do $$ begin
  execute $p$create policy "dietary_reinforcements_ins_noviewer" on dietary_reinforcements as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "dietary_reinforcements_upd_noviewer" on dietary_reinforcements as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "dietary_reinforcements_del_noviewer" on dietary_reinforcements as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

-- ── Preparação em unidoses — grelha semanal dia×turno por residente ─────────
create table if not exists medication_prep_logs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations(id) on delete set null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  week_start       date not null,
  weekday          int not null,
  shift            text not null default 'manha',
  packed           boolean not null default false,
  packed_by_id     uuid references auth.users(id),
  packed_at        timestamptz,
  created_at       timestamptz not null default now()
);
do $$ begin
  alter table medication_prep_logs add constraint medication_prep_logs_weekday_check check (weekday between 0 and 6);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table medication_prep_logs add constraint medication_prep_logs_shift_check check (shift in ('manha', 'tarde', 'noite'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table medication_prep_logs add constraint medication_prep_logs_unique unique (patient_id, week_start, weekday, shift);
exception when duplicate_object then null; end $$;
create index if not exists medication_prep_logs_week_idx on medication_prep_logs (patient_id, week_start);
create index if not exists medication_prep_logs_org_idx on medication_prep_logs (org_id, week_start);

alter table medication_prep_logs enable row level security;
do $$ begin
  create policy "medication_prep_logs_own" on medication_prep_logs for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "medication_prep_logs_org_access" on medication_prep_logs for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;
do $$ begin
  execute $p$create policy "medication_prep_logs_ins_noviewer" on medication_prep_logs as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "medication_prep_logs_upd_noviewer" on medication_prep_logs as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "medication_prep_logs_del_noviewer" on medication_prep_logs as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

-- ── Apoio psico-social + encaminhamento (SÓ EQUIPA — nunca family-portal) ───
create table if not exists psychosocial_notes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references organizations(id) on delete set null,
  user_id           uuid not null references auth.users(id) on delete cascade,
  patient_id        uuid not null references patients(id) on delete cascade,
  date              date not null default current_date,
  note              text not null,
  referred_to       text,
  referral_status   text,
  referral_date     date,
  recorded_by_id    uuid references auth.users(id),
  created_at        timestamptz not null default now()
);
do $$ begin
  alter table psychosocial_notes add constraint psychosocial_notes_referral_status_check check (referral_status is null or referral_status in ('sugerido', 'agendado', 'em_curso', 'concluido'));
exception when duplicate_object then null; end $$;
create index if not exists psychosocial_notes_patient_idx on psychosocial_notes (patient_id, date desc);
create index if not exists psychosocial_notes_org_idx on psychosocial_notes (org_id, date desc);

alter table psychosocial_notes enable row level security;
do $$ begin
  create policy "psychosocial_notes_own" on psychosocial_notes for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "psychosocial_notes_org_access" on psychosocial_notes for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;
do $$ begin
  execute $p$create policy "psychosocial_notes_ins_noviewer" on psychosocial_notes as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "psychosocial_notes_upd_noviewer" on psychosocial_notes as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "psychosocial_notes_del_noviewer" on psychosocial_notes as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

-- ── Categoria de stock "incontinência" (fraldas/pensos/resguardos) ──────────
-- Sem CHECK constraint para respeitar (sprint32 já a removeu de propósito) —
-- só documentação: a categoria 'incontinencia' passa a existir no cliente
-- (app/stock/page.tsx), nada a alterar aqui na base de dados.
