-- sprint100_copilot_memory.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda 9 — memória persistente do Phlox Copilot (diferenciador Pro).
--
-- Guarda factos curtos e duráveis que o Copilot aprende ao longo das conversas
-- (ex.: "prefere respostas curtas", "alergia a penicilina confirmada"), por
-- utilizador e por pessoa em foco (scope_key = 'self' ou o id do doente/
-- familiar). Lidos no início de cada conversa para o Copilot ficar mais
-- inteligente ao longo do tempo, em vez de recomeçar do zero em cada sessão.
--
-- Memória PESSOAL do utilizador (não partilhada por organização): quem faz a
-- pergunta é quem beneficia da personalização, mesmo em conta institucional.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists copilot_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  scope_key text not null default 'self',
  fact text not null,
  created_at timestamptz default now()
);

create index if not exists copilot_memory_user_scope_idx on copilot_memory (user_id, scope_key, created_at desc);

alter table copilot_memory enable row level security;
create policy "copilot_memory_own" on copilot_memory
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
