-- sprint102_skin_lesion_tracking.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- PRO RONDA 3 — Rastreio Visual com risco dermatológico ABCDE. 2026-07-15.
-- Cada "track" é uma lesão/mancha que a pessoa decide vigiar (ex: "sinal no
-- braço esquerdo"); cada foto tirada ao longo do tempo é pontuada por IA de
-- visão nos critérios ABCDE (assimetria/bordo/cor/diâmetro/evolução) — a
-- "evolução" compara-se com as fotos anteriores da MESMA track.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists skin_lesion_tracks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid references family_profiles(id) on delete cascade,  -- null = próprio
  label       text not null,                 -- ex: "Sinal no braço esquerdo"
  body_area   text,                          -- ex: "Braço esquerdo"
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists skin_lesion_tracks_idx on skin_lesion_tracks (user_id, archived);

create table if not exists skin_lesion_photos (
  id           uuid primary key default gen_random_uuid(),
  track_id     uuid not null references skin_lesion_tracks(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  photo_url    text not null,
  abcde        jsonb not null default '{}'::jsonb,   -- { asymmetry, border, color, diameter_mm, evolution_note }
  risk_score   integer not null check (risk_score between 0 and 100),
  risk_level   text not null check (risk_level in ('baixo','moderado','alto')),
  taken_at     timestamptz not null default now()
);
create index if not exists skin_lesion_photos_idx on skin_lesion_photos (track_id, taken_at desc);

alter table skin_lesion_tracks enable row level security;
alter table skin_lesion_photos enable row level security;
do $$ begin create policy "slt_own" on skin_lesion_tracks for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "slp_own" on skin_lesion_photos for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
