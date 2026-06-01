-- sprint44_quiz_feedback.sql
-- Phlox — Reporte de erro em perguntas/casos gerados.
-- Qualquer utilizador autenticado pode reportar; a equipa revê na tabela.
-- Anti-spam: 1 reporte por (user, source_key) — UNIQUE constraint.

create table if not exists quiz_feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  source       text not null check (source in ('arena','cases','exam','flashcards','decisao','other')),
  source_key   text not null,                          -- id do caso/pergunta (hash do conteúdo se não tem id)
  reason       text not null check (reason in (
                  'resposta_errada','duas_corretas','linguagem',
                  'referencia_invalida','desatualizado','outro'
                )),
  comment      text,                                   -- opcional, do utilizador
  question_snapshot jsonb,                             -- snapshot do que viu (para reprodutibilidade)
  status       text not null default 'open' check (status in ('open','investigating','fixed','dismissed')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id),
  unique (user_id, source, source_key)
);

create index if not exists quiz_feedback_status_idx on quiz_feedback(status, created_at desc);
create index if not exists quiz_feedback_source_idx on quiz_feedback(source, created_at desc);

alter table quiz_feedback enable row level security;

do $$ begin
  create policy "quiz_feedback_insert_own" on quiz_feedback for insert
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  -- Cada utilizador vê os seus reports (transparência) — mas não os dos outros.
  create policy "quiz_feedback_select_own" on quiz_feedback for select
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
