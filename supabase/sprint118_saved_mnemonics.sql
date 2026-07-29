-- sprint118_saved_mnemonics.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Modo ESTUDANTE — Mnemónicas visuais (/mnemonicas). Baralho pessoal de
-- mnemónicas guardadas, persistido na conta (cross-device), à semelhança de
-- study_notes / exam_goals — uma linha por mnemónica guardada, RLS "own".
-- O gerador em si (app/api/mnemonicas) não grava nada; só grava quando o
-- estudante escolhe "Guardar no baralho".
-- 2026-07-29. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists saved_mnemonics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  concept     text not null,
  area        text,                 -- área de estudo no momento (ex: "Farmácia")
  technique   text,                 -- 'sigla' | 'historia' | 'palavra-chave'
  mnemonic    text not null,        -- a frase/sigla memorável
  scene       text,                 -- a imagem mental / história visual
  icon        text,                 -- 1 emoji âncora do conceito
  breakdown   jsonb,                -- [{ letter, stands_for, icon? }]
  tip         text,
  alt         text,
  created_at  timestamptz not null default now()
);
create index if not exists saved_mnemonics_user_idx on saved_mnemonics(user_id, created_at desc);

alter table saved_mnemonics enable row level security;
do $$ begin
  create policy "saved_mnemonics_own" on saved_mnemonics for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
