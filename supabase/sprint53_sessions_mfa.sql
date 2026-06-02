-- sprint53_sessions_mfa.sql
-- Phlox — Sessões ativas + metadados MFA.
--
-- Supabase já guarda refresh tokens internamente. Esta tabela espelha as
-- sessões com metadados úteis para o utilizador (dispositivo, IP, geo,
-- last_seen). O cliente bate este endpoint /api/sessions/heartbeat a cada
-- N minutos; o servidor mantém atualizado.

create table if not exists user_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  device_label  text,                                   -- 'Chrome no Mac · Lisboa'
  user_agent    text,
  ip_first      text,
  ip_last       text,
  geo_first     text,                                   -- 'PT · Lisboa'
  geo_last      text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  revoked       boolean not null default false,
  revoked_at    timestamptz,
  metadata      jsonb default '{}'::jsonb
);

create index if not exists user_sessions_user_idx on user_sessions(user_id, last_seen_at desc);
create index if not exists user_sessions_active_idx on user_sessions(user_id) where revoked = false;

alter table user_sessions enable row level security;

do $$ begin
  create policy "user_sessions_own" on user_sessions for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── Anomalias de acesso ────────────────────────────────────────────────────
-- Populada por job server-side (motor leve de regras + isolation forest no
-- futuro). Mostrada em /settings/seguranca.
create table if not exists access_anomalies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  detected_at  timestamptz not null default now(),
  kind         text not null check (kind in (
                 'new_country','new_device','high_volume',
                 'off_hours','impossible_travel','other'
               )),
  severity     text not null default 'info' check (severity in ('info','warning','critical')),
  description  text not null,
  evidence     jsonb,
  acknowledged boolean not null default false,
  ack_at       timestamptz
);

create index if not exists access_anomalies_user_idx on access_anomalies(user_id, detected_at desc);
alter table access_anomalies enable row level security;

do $$ begin
  create policy "access_anomalies_own" on access_anomalies for select
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
