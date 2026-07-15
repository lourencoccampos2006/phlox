-- sprint101_crisis_playbook.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- PRO RONDA 3 — Playbook de Crise personalizado (objetivo=cuidador). 2026-07-15.
-- 1 playbook por familiar, gerado por IA a partir das condições/medicação REAIS
-- da pessoa, cacheado (regenera só quando algo muda — source_hash compara).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists family_crisis_playbooks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references family_profiles(id) on delete cascade,
  source_hash   text not null,          -- hash simples de condições+alergias+medicação; muda → regenerar
  scenarios     jsonb not null default '[]'::jsonb,
  generated_at  timestamptz not null default now(),
  unique (profile_id)
);

alter table family_crisis_playbooks enable row level security;
do $$ begin create policy "fcp_own" on family_crisis_playbooks for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
