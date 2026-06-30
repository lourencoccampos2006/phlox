-- sprint95_caregiver.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RONDA 2 — Modo CUIDADOR proativo ("Anjo da Guarda").
-- Fundação para: lembretes de medicação de familiares, vigilância proativa
-- (alertas persistidos por familiar), e cofre de documentos por familiar.
-- Tudo do dono (user_id), separado do sistema institucional (org_id). RLS própria.
-- 2026-06-28.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Medicação de familiares: faltavam campos para lembretes funcionarem.
alter table family_profile_meds
  add column if not exists reminder_times text[],                         -- ex: {'09:00','21:00'}
  add column if not exists active boolean not null default true,
  add column if not exists take_location text check (take_location in ('casa','centro','ambos')) default 'casa';

-- 2) Registo de tomas por familiar (adesão) — med_logs era só do próprio.
--    Mantemos simples: 1 linha por toma marcada de um family_profile_med.
create table if not exists family_med_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,   -- o cuidador
  profile_id  uuid not null references family_profiles(id) on delete cascade,
  med_id      uuid references family_profile_meds(id) on delete cascade,
  date        date not null default current_date,
  time_slot   text,                                                        -- ex: '09:00'
  status      text not null default 'taken' check (status in ('taken','missed','skipped')),
  taken_at    timestamptz default now()
);
create index if not exists family_med_logs_idx on family_med_logs (profile_id, date desc);

-- 3) Alertas proativos do cuidador (persistidos, por familiar). O motor de
--    vigilância (lib/caregiverWatch) gera-os; o cron notifica 1x; o cuidador
--    pode dispensar/adiar. Dedup pela chave (profile_id, kind, dia).
create table if not exists family_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references family_profiles(id) on delete cascade,
  kind          text not null,                  -- ex: 'bp_high', 'stock_low', 'interaction'
  severity      text not null check (severity in ('critical','major','moderate','minor','info')),
  title         text not null,
  detail        text,
  action        text,
  cta_href      text,
  created_at    timestamptz not null default now(),
  notified_at   timestamptz,                    -- quando o cron mandou push/email
  dismissed_at  timestamptz,
  snoozed_until timestamptz
);
create index if not exists family_alerts_open_idx on family_alerts (user_id, dismissed_at) where dismissed_at is null;
create unique index if not exists family_alerts_dedup on family_alerts (profile_id, kind, (created_at::date));

-- 4) Cofre de documentos POR FAMILIAR (fotografar exames/receitas, perguntar, partilhar).
create table if not exists family_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid references family_profiles(id) on delete cascade,        -- null = próprio
  title       text not null,
  kind        text,                              -- 'exame','receita','relatorio','outro'
  extracted_text text,                           -- texto OCR (para perguntar sem embeddings)
  summary     text,
  file_url    text,
  created_at  timestamptz not null default now()
);
create index if not exists family_documents_idx on family_documents (user_id, profile_id, created_at desc);

-- ─── RLS — tudo do próprio cuidador ──────────────────────────────────────────
alter table family_med_logs  enable row level security;
alter table family_alerts    enable row level security;
alter table family_documents enable row level security;

do $$ begin create policy "fml_own" on family_med_logs  for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "fa_own"  on family_alerts    for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "fd_own"  on family_documents for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- Realtime (opcional) para o /familia atualizar ao vivo.
do $$ begin alter publication supabase_realtime add table family_alerts; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table family_med_logs; exception when others then null; end $$;
