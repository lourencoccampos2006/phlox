-- sprint105_team_comms.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RONDA 13 — Comunicação da EQUIPA (institucional).
-- Um mural por organização, com canais: mensagens gerais, doentes, stock, avisos.
-- Cada funcionário escreve, todos veem; push para os outros membros da org.
-- Org-scoped (sprint91/97), com quem escreveu e prioridade.
-- 2026-07-05.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists team_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid references organizations(id) on delete set null,
  author_id    uuid references auth.users(id),
  author_name  text,
  channel      text not null default 'geral' check (channel in ('geral','doentes','stock','avisos')),
  patient_id   uuid references patients(id) on delete set null,  -- opcional (canal doentes)
  body         text not null,
  priority     text not null default 'normal' check (priority in ('normal','importante','urgente')),
  resolved     boolean not null default false,   -- para avisos/pedidos que se "fecham"
  created_at   timestamptz not null default now()
);
create index if not exists tm_org_idx on team_messages (org_id, created_at desc) where org_id is not null;
create index if not exists tm_channel_idx on team_messages (org_id, channel, created_at desc) where org_id is not null;

alter table team_messages enable row level security;
do $$ begin
  create policy "tm_own" on team_messages for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "tm_org_access" on team_messages for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table team_messages; exception when others then null; end $$;

-- Estado de leitura por membro (para o badge "não lidas"). Simples: guarda a
-- última leitura por (user, org). Tudo o que for mais recente conta como não lido.
create table if not exists team_reads (
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  last_read   timestamptz not null default now(),
  primary key (user_id, org_id)
);
alter table team_reads enable row level security;
do $$ begin
  create policy "tr_own" on team_reads for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
