-- sprint47_premium_caregiver.sql
-- Phlox — Funcionalidades premium do plano CUIDADOR FAMILIAR.

-- ── Burden tracking (escala Zarit-12) ───────────────────────────────────────
-- A escala Zarit é a referência mundial para sobrecarga do cuidador.
-- Versão curta de 12 itens (Bedard 2001), score 0-48.
create table if not exists caregiver_burden (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  caring_for   text not null,                         -- nome do familiar
  measured_at  date not null default current_date,
  answers      jsonb not null,                        -- {q1..q12} 0-4
  total        int not null,
  band         text not null check (band in ('sem_sobrecarga','sobrecarga_leve','sobrecarga_moderada','sobrecarga_grave')),
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists caregiver_burden_user_idx on caregiver_burden(user_id, measured_at desc);
alter table caregiver_burden enable row level security;
do $$ begin
  create policy "caregiver_burden_own" on caregiver_burden for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── Family inbox: cuidador apanha tudo o que aconteceu hoje em cada familiar
-- Vista materializada simples; é gerada client-side a partir de tabelas
-- existentes (med_logs, vital_signs, cal_events) — sem schema novo.

-- ── Medicine audit cross-family ─────────────────────────────────────────────
-- Não precisa de tabela própria; consulta personal_meds com agregação por DCI.

-- ── Reconciliação medicamentos ───────────────────────────────────────────────
-- Snapshots da receita para comparar antes vs depois (admissão, alta, mudança).
create table if not exists med_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  for_profile  text not null,                         -- nome do familiar
  label        text not null,                         -- ex: 'Antes da alta hospitalar', 'Pré-internamento'
  taken_at     timestamptz not null default now(),
  meds         jsonb not null,                        -- [{name, dose, frequency, notes}]
  source       text                                   -- 'receita_pdf','manual','sclinico', etc.
);
create index if not exists med_snapshots_user_idx on med_snapshots(user_id, taken_at desc);
alter table med_snapshots enable row level security;
do $$ begin
  create policy "med_snapshots_own" on med_snapshots for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
