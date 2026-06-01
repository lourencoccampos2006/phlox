-- sprint45_study_documents.sql
-- Phlox — Biblioteca de documentos de estudo do utilizador.
-- O utilizador faz upload de PDFs, Word, slides ou cola texto e o Phlox
-- gera resumo, mapa conceptual, perguntas e plano de estudo. Cada documento
-- fica na biblioteca pessoal — pesquisável, com tags, derivações guardadas.
--
-- O ficheiro original NÃO é guardado (privacidade + custo); só o texto
-- extraído e os artefactos gerados pela AI.

create table if not exists study_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  kind          text not null check (kind in ('pdf','docx','pptx','text','image_ocr','url')),
  subject       text,                                  -- "Farmacologia", "Cardiologia", etc.
  source_filename text,                                -- nome original (sem o ficheiro)
  page_count    int,
  chars         int,                                   -- tamanho do texto extraído
  text_content  text not null,                         -- texto extraído (pode ser grande)
  summary       text,                                  -- resumo AI (lazy — pode ser null inicialmente)
  outline       jsonb,                                 -- estrutura: secções, sub-secções
  key_concepts  jsonb,                                 -- [{ term, definition, importance }]
  generated_quiz jsonb,                                -- perguntas geradas para este documento
  generated_flashcards jsonb,                          -- flashcards gerados
  pinned        boolean not null default false,
  tags          text[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_opened_at timestamptz
);

create index if not exists study_documents_user_idx
  on study_documents(user_id, updated_at desc);
create index if not exists study_documents_subject_idx
  on study_documents(user_id, subject)
  where subject is not null;

alter table study_documents enable row level security;

do $$ begin
  create policy "study_documents_own" on study_documents for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Trigger updated_at
create or replace function study_documents_touch() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

do $$ begin
  create trigger study_documents_touch_t before update on study_documents
    for each row execute procedure study_documents_touch();
exception when duplicate_object then null; end $$;
