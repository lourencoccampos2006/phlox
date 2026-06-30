-- sprint96_study_progress_sync.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RONDA 4 — Modo ESTUDANTE: cérebro de progresso NA CONTA (cross-device).
-- Até agora o progresso de estudo (streak/XP/áreas-fracas/meta) vivia só em
-- localStorage (lib/studyProgress) → perdia-se ao trocar de dispositivo ou limpar
-- o browser. Esta tabela guarda-o na conta, com write-through + merge a partir do
-- cliente. 1 linha por utilizador. Eventos como jsonb (casa com o formato atual).
-- O código degrada para localStorage se esta tabela não existir.
-- 2026-06-29.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists study_progress_sync (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  events     jsonb not null default '[]'::jsonb,   -- [{kind, area?, correct?, xp, at}], mais recente primeiro
  daily_goal int   not null default 50,
  last_tool  jsonb,                                 -- {href, label, at}
  updated_at timestamptz not null default now()
);

-- ─── RLS — cada estudante só vê/escreve o seu ───────────────────────────────
alter table study_progress_sync enable row level security;
do $$ begin
  create policy "sps_own" on study_progress_sync for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
