-- Sprint 29: Phlox Health Pass — QR de saúde para mostrar a qualquer profissional.
-- O doente ativa uma SESSÃO de partilha (com PIN, expira). O profissional abre o QR,
-- introduz o PIN e vê o resumo escolhido. Se o profissional tiver Phlox, a visita
-- fica registada e pode devolver dados ao doente.
-- Run in Supabase SQL Editor.

-- ── Sessões de partilha (efémeras) ───────────────────────────────────────────
create table if not exists health_pass_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  profile_id uuid,                       -- family_profiles.id ou null (próprio)
  token text not null unique,            -- vai no QR/URL
  pin text not null,                     -- 4-6 dígitos que o doente diz ao profissional
  sections text[] not null default '{}', -- secções partilhadas: meds, conditions, allergies, symptoms, vitals, visits
  expires_at timestamptz not null,
  revoked boolean not null default false,
  opened_count int not null default 0,
  created_at timestamptz default now()
);
alter table health_pass_sessions enable row level security;
do $$ begin
  create policy "hps_own" on health_pass_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists hps_token_idx on health_pass_sessions(token);

-- ── Visitas (idas ao médico/farmácia/CS) — histórico com o motivo ────────────
create table if not exists health_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  profile_id uuid,
  at timestamptz not null default now(),
  professional_name text,                -- preenchido se o profissional tiver Phlox
  professional_role text,
  institution text,
  institution_type text,                 -- pharmacy_community | clinic | health_center | hospital | nursing_home
  reason text,                           -- motivo da consulta
  notes text,                            -- nota devolvida pelo profissional
  source text not null default 'manual', -- manual | healthpass
  created_at timestamptz default now()
);
alter table health_visits enable row level security;
do $$ begin
  create policy "hv_own" on health_visits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists hv_idx on health_visits(user_id, profile_id, at desc);

-- ── Devoluções do profissional ao doente (medicação/consulta/nota propostas) ──
create table if not exists health_pass_returns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references health_pass_sessions(id) on delete cascade,
  user_id uuid not null,                 -- dono dos dados (doente)
  profile_id uuid,
  kind text not null,                    -- medication | appointment | note
  payload jsonb not null,                -- {name,dose,...} | {date,specialty} | {text}
  from_professional text,
  applied boolean not null default false,
  created_at timestamptz default now()
);
alter table health_pass_returns enable row level security;
do $$ begin
  create policy "hpr_own" on health_pass_returns for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists hpr_idx on health_pass_returns(user_id, applied);
