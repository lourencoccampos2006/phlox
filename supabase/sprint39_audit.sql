-- sprint39_audit.sql
-- Phlox Audit Trail — registo IMUTÁVEL de eventos sensíveis com cadeia SHA-256.
-- Cada evento referencia o hash do anterior do MESMO utilizador. Permite verificar
-- posteriormente que nenhum registo foi adulterado ou removido.
-- RLS: o utilizador só lê os SEUS eventos. INSERT só via service role (server-side)
-- ou via política específica para garantir integridade do prev_hash.

create table if not exists audit_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  at          timestamptz not null default now(),
  action      text not null,                  -- ex: patient.viewed, sale.created, login, settings.changed
  category    text not null default 'general', -- clinical | billing | auth | settings | data
  resource    text,                            -- tipo do recurso (patient, sale, …)
  resource_id text,                            -- id do recurso (uuid ou identificador)
  ip          text,
  user_agent  text,
  detail      jsonb not null default '{}'::jsonb,
  prev_hash   text,                            -- hash do evento anterior (do mesmo user_id)
  event_hash  text not null,                   -- SHA-256(canonical(json))
  seq         bigint not null                  -- nº sequencial por utilizador
);
create index if not exists audit_events_user_idx on audit_events(user_id, at desc);
create index if not exists audit_events_seq_idx on audit_events(user_id, seq desc);
create index if not exists audit_events_action_idx on audit_events(user_id, action);
alter table audit_events enable row level security;
do $$ begin create policy "audit_events_read_own" on audit_events for select using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
-- INSERT/UPDATE/DELETE não permitidos via RLS — só via service role (encadear hash em servidor).

-- Aloca o próximo seq atómico para um utilizador
create or replace function next_audit_seq(p_user uuid)
returns bigint language plpgsql security definer as $$
declare v_seq bigint;
begin
  -- Tabela auxiliar implícita: max(seq) + 1 com lock advisory
  perform pg_advisory_xact_lock(hashtext('audit_seq_' || p_user::text));
  select coalesce(max(seq), 0) + 1 into v_seq from audit_events where user_id = p_user;
  return v_seq;
end $$;
