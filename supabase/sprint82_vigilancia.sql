-- sprint82_vigilancia.sql
-- Phlox — Vigilância Clínica do Lar (institucional). Guarda o resultado da
-- análise farmacológica/risco por doente para alimentar o painel e os relatórios.
--
-- 2026-06-05. Idempotente.

create table if not exists patient_vigilance (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  patient_id  uuid not null,
  risk_score  int default 0,            -- 0-100 calculado
  alerts      jsonb not null default '[]'::jsonb,   -- alertas (interação/STOPP/dose/monitor)
  flags       text[] default '{}',       -- ex: ['polimedicação','idoso','renal']
  summary     text,
  analysed_at timestamptz not null default now(),
  unique (user_id, patient_id)
);
create index if not exists pv_user_idx on patient_vigilance(user_id, risk_score desc);

alter table patient_vigilance enable row level security;
do $$ begin
  create policy "pv_own" on patient_vigilance for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
