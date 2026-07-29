-- sprint118_consult_prep.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- "Preparar a consulta" (pessoal/cuidador) — a API /api/preparar-consulta já
-- existia (aiJSON: resumo, perguntas a fazer, sinais a referir, o que levar,
-- red flags, possíveis ligações entre sintomas e medicação) mas NUNCA teve
-- página nenhuma a chamá-la — zero utilizadores conseguiam lá chegar.
--
-- Esta tabela guarda o histórico de folhas geradas (para reabrir/reimprimir
-- antes da consulta real, sem ter de escrever tudo outra vez). RLS: só o
-- próprio dono (user_id = auth.uid()), mesmo padrão do resto do produto.
-- 2026-07-29.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists consult_preps (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid references family_profiles(id) on delete cascade,   -- null = próprio
  specialty     text,
  notes         text not null,
  result        jsonb not null,
  created_at    timestamptz not null default now()
);
create index if not exists consult_preps_idx on consult_preps (user_id, created_at desc);

alter table consult_preps enable row level security;

do $$ begin
  create policy "consult_preps_own" on consult_preps
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
