-- sprint111_zarit_burden.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- MELHORIAS 2026-07-17 (item A4) — escala Zarit-12 de sobrecarga do cuidador.
-- A lógica de pontuação (lib/caregiverScales.ts) já existia mas ficou órfã
-- (sem UI nem tabela) desde a Ronda 13b, quando /familia360 foi cortado para
-- um redirect. Cada avaliação é ligada a UM familiar (a escala pergunta pelo
-- "seu familiar" no singular) — um cuidador pode ter sobrecarga diferente
-- consoante a pessoa de quem cuida, por isso profile_id não é nullable aqui
-- (ao contrário do skin_lesion_tracks, que suporta "próprio").
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists caregiver_burden_checks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid not null references family_profiles(id) on delete cascade,
  answers      jsonb not null,             -- array de 12 inteiros 0-4
  total_score  integer not null check (total_score between 0 and 48),
  band         text not null check (band in ('sem_sobrecarga','sobrecarga_leve','sobrecarga_moderada','sobrecarga_grave')),
  created_at   timestamptz not null default now()
);
create index if not exists caregiver_burden_checks_idx on caregiver_burden_checks (profile_id, created_at desc);

alter table caregiver_burden_checks enable row level security;
do $$ begin create policy "cbc_own" on caregiver_burden_checks for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
