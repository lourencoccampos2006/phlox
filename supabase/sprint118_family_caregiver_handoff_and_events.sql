-- sprint118_family_caregiver_handoff_and_events.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda cuidador 2026-07-29 — duas features novas para famílias com MAIS DE UM
-- cuidador (family_profile_shares, sprint112). Já existia o quadro "Preciso de
-- ajuda" (family_help_requests, tarefas pontuais) — faltavam:
--   (1) uma PASSAGEM DE CUIDADO estruturada para quando a responsabilidade
--       muda de mãos por um período (ex: um irmão cobre o outro uma semana) —
--       distinta da "Ficha para o hospital" (HandoffSheetButton), que é um
--       documento IMPRESSO gerado a partir de dados já existentes, sem autoria
--       nem persistência. Esta é uma nota escrita por UM cuidador PARA o
--       próximo, com confirmação de leitura.
--   (2) uma AGENDA PARTILHADA para consultas e turnos de cobertura entre
--       cuidadores.
--
-- Mesmo padrão de acesso de family_help_requests/family_profile_med_logs: a
-- policy de RLS dá leitura+escrita a quem é DONO do perfil OU tem PARTILHA
-- ATIVA (family_profile_shares, revoked_at is null). As rotas de API fazem a
-- verificação extra por registo — quem pode editar/apagar/desmarcar ESTE item
-- específico — porque a RLS só sabe "tem acesso ao perfil", não "é o dono
-- deste registo". Ver nota de segurança em app/api/family-help/route.ts sobre
-- os 2 IDOR corrigidos ali esta noite: um viewer partilhado conseguia
-- desreclamar/apagar itens de OUTRO viewer só por ter acesso ao perfil. As
-- rotas novas (family-handoff, family-events) replicam a correção desde o
-- início — ver hasAccess() + os checks extra de created_by/claimed_by/
-- acknowledged_by/assigned_to em cada handler.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Passagem de cuidado ──────────────────────────────────────────────────────
create table if not exists family_handoff_notes (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references family_profiles(id) on delete cascade,
  created_by      uuid not null references auth.users(id) on delete cascade,
  starts_at       date not null default current_date,
  ends_at         date,
  summary         text not null,
  watch_for       text,
  med_changes     text,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists family_handoff_notes_profile_idx on family_handoff_notes (profile_id, starts_at desc);

alter table family_handoff_notes enable row level security;
do $$ begin
  create policy "fhn_access" on family_handoff_notes for all using (
    profile_id in (select id from family_profiles where user_id = auth.uid())
    or profile_id in (select profile_id from family_profile_shares where viewer_user_id = auth.uid() and revoked_at is null)
  ) with check (
    profile_id in (select id from family_profiles where user_id = auth.uid())
    or profile_id in (select profile_id from family_profile_shares where viewer_user_id = auth.uid() and revoked_at is null)
  );
exception when duplicate_object then null; end $$;

-- ── Agenda partilhada (consultas + turnos de cobertura) ──────────────────────
create table if not exists family_profile_events (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references family_profiles(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  kind         text not null default 'appointment',
  title        text not null,
  location     text,
  notes        text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  assigned_to  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists family_profile_events_profile_idx on family_profile_events (profile_id, starts_at);

do $$ begin
  alter table family_profile_events add constraint family_profile_events_kind_check check (kind in ('appointment', 'coverage'));
exception when duplicate_object then null; end $$;

alter table family_profile_events enable row level security;
do $$ begin
  create policy "fpe_access" on family_profile_events for all using (
    profile_id in (select id from family_profiles where user_id = auth.uid())
    or profile_id in (select profile_id from family_profile_shares where viewer_user_id = auth.uid() and revoked_at is null)
  ) with check (
    profile_id in (select id from family_profiles where user_id = auth.uid())
    or profile_id in (select profile_id from family_profile_shares where viewer_user_id = auth.uid() and revoked_at is null)
  );
exception when duplicate_object then null; end $$;
