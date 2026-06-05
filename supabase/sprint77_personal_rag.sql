-- sprint77_personal_rag.sql
-- Phlox — RAG pessoal (Pro). O utilizador carrega os SEUS documentos
-- (PDFs, slides, sebentas) e a IA passa a responder COM BASE no material dele,
-- citando o documento e o trecho.
--
-- Recuperação por full-text (sem embeddings) — robusto, sem custo, funciona em
-- qualquer Postgres. Cada documento é partido em chunks pesquisáveis.
--
-- 2026-06-05. Idempotente.

-- ─── Documentos do utilizador ──────────────────────────────────────────────
create table if not exists user_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  kind        text default 'pdf',          -- pdf | slides | text | note
  domain      text,
  char_count  int default 0,
  chunk_count int default 0,
  created_at  timestamptz not null default now()
);
create index if not exists user_docs_user_idx on user_documents(user_id, created_at desc);

alter table user_documents enable row level security;
do $$ begin
  create policy "user_documents_own" on user_documents for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── Chunks pesquisáveis ───────────────────────────────────────────────────
create table if not exists document_chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references user_documents(id) on delete cascade,
  idx         int not null default 0,       -- ordem no documento
  content     text not null,
  tsv         tsvector,
  created_at  timestamptz not null default now()
);
create index if not exists doc_chunks_doc_idx on document_chunks(document_id, idx);
create index if not exists doc_chunks_tsv_idx on document_chunks using gin(tsv);

-- Atualiza tsvector (português) sempre que o conteúdo muda
create or replace function document_chunks_tsv_update() returns trigger
language plpgsql as $$
begin
  new.tsv := to_tsvector('portuguese', coalesce(new.content, ''));
  return new;
end;
$$;
drop trigger if exists doc_chunks_tsv on document_chunks;
create trigger doc_chunks_tsv before insert or update on document_chunks
  for each row execute procedure document_chunks_tsv_update();

alter table document_chunks enable row level security;
do $$ begin
  create policy "document_chunks_own" on document_chunks for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── RPC: recuperar chunks relevantes para uma pergunta ────────────────────
-- Devolve os melhores trechos do material do utilizador (full-text ranking).
create or replace function search_my_documents(p_query text, p_limit int default 6)
returns table (chunk_id uuid, document_id uuid, doc_title text, content text, rank real)
language sql security definer set search_path = public as $$
  select c.id, c.document_id, d.title, c.content,
         ts_rank(c.tsv, websearch_to_tsquery('portuguese', p_query)) as rank
  from document_chunks c
  join user_documents d on d.id = c.document_id
  where c.user_id = auth.uid()
    and c.tsv @@ websearch_to_tsquery('portuguese', p_query)
  order by rank desc
  limit greatest(1, least(p_limit, 12));
$$;

grant execute on function search_my_documents(text, int) to authenticated;
