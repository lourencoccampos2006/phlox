-- sprint84_rag_fix.sql
-- Phlox — corrige a procura RAG (/study/documentos e /study/exame).
-- Problema: websearch_to_tsquery exige TODAS as palavras (AND) → muitas perguntas
-- devolviam 0 resultados ("não encontrei nada no teu documento").
-- Solução: OR semântico (qualquer palavra relevante conta) + fallback ILIKE.
-- 2026-06-07. Idempotente.

create or replace function search_my_documents(p_query text, p_limit int default 6)
returns table (chunk_id uuid, document_id uuid, doc_title text, content text, rank real)
language plpgsql security definer set search_path = public as $$
declare
  v_lim int := greatest(1, least(coalesce(p_limit, 6), 12));
  v_tsq tsquery;
  v_words text;
begin
  -- Constrói uma tsquery OR a partir das palavras com ≥3 letras (ignora stopwords/ruído).
  select string_agg(w, ' | ') into v_words
  from (
    select distinct lower(m[1]) as w
    from regexp_matches(lower(coalesce(p_query, '')), '([a-zà-ú]{3,})', 'g') as m
  ) q;

  if v_words is not null and length(v_words) > 0 then
    begin
      v_tsq := to_tsquery('portuguese', v_words);
    exception when others then
      v_tsq := null;
    end;
  end if;

  -- 1) Full-text OR (relevância)
  if v_tsq is not null then
    return query
      select c.id, c.document_id, d.title, c.content,
             ts_rank(c.tsv, v_tsq) as rank
      from document_chunks c
      join user_documents d on d.id = c.document_id
      where c.user_id = auth.uid() and c.tsv @@ v_tsq
      order by rank desc
      limit v_lim;
    if found then return; end if;
  end if;

  -- 2) Fallback ILIKE — apanha quando o full-text falha (acentos, termos técnicos)
  return query
    select c.id, c.document_id, d.title, c.content, 0.01::real as rank
    from document_chunks c
    join user_documents d on d.id = c.document_id
    where c.user_id = auth.uid()
      and (
        c.content ilike '%' || coalesce(p_query, '') || '%'
        or exists (
          select 1 from regexp_matches(lower(p_query), '([a-zà-ú]{4,})', 'g') as m
          where c.content ilike '%' || m[1] || '%'
        )
      )
    order by length(c.content) asc
    limit v_lim;
end;
$$;

grant execute on function search_my_documents(text, int) to authenticated;

-- Reindexa tsv de chunks existentes (caso tenham sido inseridos antes do trigger).
update document_chunks set content = content where tsv is null;
