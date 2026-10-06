-- supabase/sprint169_recorded_by_id.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto assim que puderes. É curto e desbloqueia quase tudo o
-- que foi construído esta semana.
--
-- ── O QUE ESTÁ PARTIDO ──────────────────────────────────────────────────────
-- «As etiquetas não funcionam, não dá para adicionar etiquetas a utentes.»
--
-- Não são só as etiquetas. São ONZE tabelas, e o motivo é o mesmo em todas.
--
-- Todo o código que escreve numa tabela da casa passa por `scope.stamp()`
-- (lib/orgScope.ts). Essa função acrescenta três coisas: `user_id`, `org_id`
-- e — quando há organização — `recorded_by_id`, que é a coluna de auditoria
-- que diz QUEM carregou no botão.
--
-- As tabelas que criei esta semana não têm essa coluna. E o PostgREST recusa
-- a escrita INTEIRA quando se lhe manda uma coluna que não existe:
--
--     POST /rest/v1/etiquetas_do_utente
--     → 400  Could not find the 'recorded_by_id' column
--
-- Medido hoje contra esta base de dados: com a coluna no corpo, 400; sem ela,
-- 201. Ou seja, pôr uma etiqueta numa pessoa NUNCA funcionou — e o mesmo para
-- inscrever alguém, marcar no calendário, guardar um modelo, criar um serviço
-- no catálogo ou acrescentar um objetivo ao plano.
--
-- ── PORQUE É QUE A COLUNA VAI PARA AS TABELAS, E NÃO SAI DO `stamp` ────────
-- Podia ter feito o contrário: ensinar o `stamp` a não escrever a coluna onde
-- ela não existe. Mas ele não sabe em que tabela está a escrever — teria de
-- lhe passar o nome em mais de cem sítios, e bastaria esquecer um.
--
-- E a coluna é útil: `user_id` diz de quem é a linha, `recorded_by_id` diz
-- quem a escreveu. Numa casa onde três pessoas mexem na ficha da mesma
-- pessoa, é a diferença entre saber e adivinhar. A esmagadora maioria das
-- tabelas já a tem; estas é que ficaram de fora.
--
-- ── PORQUE É QUE ISTO É DINÂMICO E NÃO UMA LISTA ───────────────────────────
-- Uma lista escrita à mão é uma lista que me escapa outra vez — foi assim que
-- isto aconteceu. Acrescenta-se a coluna a TODA a tabela que tenha `org_id` e
-- não tenha `recorded_by_id`, e o `raise notice` no fim diz quais foram.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t record;
  n int := 0;
  nomes text := '';
begin
  for t in
    select c.table_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.column_name = 'org_id'
       -- Só tabelas. Uma vista não se altera, e tentar fazê-lo rebenta o
       -- bloco inteiro.
       and exists (
         select 1 from information_schema.tables x
          where x.table_schema = 'public'
            and x.table_name = c.table_name
            and x.table_type = 'BASE TABLE'
       )
       and not exists (
         select 1 from information_schema.columns y
          where y.table_schema = 'public'
            and y.table_name = c.table_name
            and y.column_name = 'recorded_by_id'
       )
     order by c.table_name
  loop
    execute format(
      'alter table public.%I add column if not exists recorded_by_id uuid '
      || 'references auth.users(id) on delete set null', t.table_name);
    n := n + 1;
    nomes := nomes || t.table_name || ', ';
  end loop;

  if n = 0 then
    raise notice 'Nada a fazer: todas as tabelas da casa ja tinham recorded_by_id.';
  else
    raise notice '% tabela(s) ganharam recorded_by_id:', n;
    raise notice '  %', rtrim(nomes, ', ');
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
-- Deve devolver ZERO linhas:
-- select c.table_name
--   from information_schema.columns c
--  where c.table_schema = 'public' and c.column_name = 'org_id'
--    and not exists (select 1 from information_schema.columns y
--                     where y.table_schema='public' and y.table_name=c.table_name
--                       and y.column_name='recorded_by_id');
--
-- E na app: abre a ficha de alguem e poe-lhe a etiqueta «Risco de queda».
-- Deve ficar la — e ao recarregar a pagina continuar la.
