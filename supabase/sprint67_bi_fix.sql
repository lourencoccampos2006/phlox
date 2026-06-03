-- sprint67_bi_fix.sql
-- Phlox — Fix do erro "syntax error at or near 'limit'" no /bi.
--
-- Causa: a função bi_run_query envolvia a SQL do utilizador com um `limit 200`
-- exterior, mas o prompt do modelo pede explicitamente "LIMIT 50". Resultado:
--   `(SELECT ... LIMIT 50 limit 200)` → PostgreSQL rejeita.
--
-- Fix: a função agora detecta se já existe LIMIT na SQL gerada e adapta. O
-- limite externo desce para 200 só quando não há limite explícito.
--
-- 2026-06-03. Idempotente.

create or replace function bi_run_query(p_sql text) returns jsonb
language plpgsql security invoker as $$
declare
  result jsonb;
  cleaned text := trim(p_sql);
  upper_sql text;
  has_limit boolean;
begin
  -- Remove pontos-e-vírgulas finais
  cleaned := regexp_replace(cleaned, ';+\s*$', '');
  upper_sql := upper(cleaned);

  if upper_sql not like 'SELECT%' and upper_sql not like 'WITH%' then
    raise exception 'Apenas SELECT é permitido';
  end if;
  if upper_sql ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|COPY|MERGE|EXECUTE)' then
    raise exception 'Comando não permitido';
  end if;

  -- Já tem LIMIT? Não envolve em sub-query (evita conflito de LIMIT duplo).
  has_limit := upper_sql ~* '\mLIMIT\M\s+\d+';

  if has_limit then
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', cleaned) into result;
  else
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s LIMIT 200) t', cleaned) into result;
  end if;

  return result;
end;
$$;

grant execute on function bi_run_query(text) to authenticated;

notify pgrst, 'reload schema';
