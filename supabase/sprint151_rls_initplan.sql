-- sprint151_rls_initplan.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: isto é PERFORMANCE, não segurança. O Supabase tem razão em
-- classificá-lo assim. Não há aqui nenhum buraco — há lentidão à espera de
-- acontecer. Corre o sprint150 primeiro; este pode esperar uns dias.
--
-- ── O QUE O AVISO QUER DIZER ────────────────────────────────────────────────
-- Uma política escrita assim:
--
--     using (user_id = auth.uid())
--
-- faz o Postgres chamar `auth.uid()` **uma vez POR LINHA** examinada. E
-- `auth.uid()` não é barato: lê e descodifica o JWT de cada vez.
--
-- Numa tabela com 12 linhas, ninguém nota. Numa tabela de registos com 50 mil,
-- são 50 mil descodificações de JWT para responder a uma pergunta — e a página
-- que abria em 200 ms passa a abrir em segundos.
--
-- Escrita assim:
--
--     using (user_id = (select auth.uid()))
--
-- o Postgres reconhece que o valor não muda durante a consulta, calcula-o UMA
-- vez (é o que o plano de execução chama "InitPlan") e compara os 50 mil
-- user_id contra um valor já em memória. O resultado é exactamente o mesmo; só
-- o trabalho é que desaparece.
--
-- ── A ESCALA AQUI ───────────────────────────────────────────────────────────
-- 397 políticas, 608 chamadas diretas a `auth.uid()`, ZERO já na forma rápida.
-- Ou seja: todas.
--
-- Hoje as tabelas são pequenas e não se nota. As que crescem depressa são as de
-- registos — `historico`, `mar_records`, `care_records`, os feeds de auditoria.
-- É nessas que isto vai doer, e é melhor arrumar antes de haver dados do que
-- depois, com clientes a queixarem-se de lentidão.
--
-- ── PORQUE É QUE ISTO NÃO MUDA SOZINHO ──────────────────────────────────────
-- Isto mexe em CONTROLO DE ACESSO. Um erro aqui não é uma página lenta: é uma
-- política que deixa de proteger. Por isso o ficheiro está em duas partes:
--
--   PARTE 1 — só MOSTRA o que seria alterado. Não muda nada. Corre esta
--             primeiro e olha para a lista.
--   PARTE 2 — aplica. Está comentada. Descomenta só depois de veres a lista.
--
-- E usa `alter policy ... using (...)`, não `drop` + `create`. A diferença
-- importa: o `alter` só troca a expressão e não pode enganar-se no comando
-- (ALL/SELECT/INSERT) nem nos papéis. Um `drop`+`create` mal feito podia deixar
-- uma tabela aberta durante o intervalo, ou recriar a política com o comando
-- errado.
-- ─────────────────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — VER. Não altera nada. Corre isto primeiro.
-- ════════════════════════════════════════════════════════════════════════════
select
  tablename                                           as tabela,
  policyname                                          as politica,
  cmd                                                 as comando,
  qual                                                as condicao_atual,
  replace(replace(replace(
    coalesce(qual, ''),
    'auth.uid()',  '(select auth.uid())'),
    'auth.jwt()',  '(select auth.jwt())'),
    'auth.role()', '(select auth.role())')            as condicao_nova
from pg_policies
where schemaname = 'public'
  and (
    qual       ~ 'auth\.(uid|jwt|role)\(\)'
    or with_check ~ 'auth\.(uid|jwt|role)\(\)'
  )
  -- As que já estão na forma rápida ficam de fora.
  and coalesce(qual, '') !~ 'select auth\.'
order by tablename, policyname;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — APLICAR. Descomenta o bloco todo depois de veres a lista acima.
-- ════════════════════════════════════════════════════════════════════════════
/*
do $$
declare
  p          record;
  nova_qual  text;
  nova_check text;
  n          int := 0;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (qual ~ 'auth\.(uid|jwt|role)\(\)' or with_check ~ 'auth\.(uid|jwt|role)\(\)')
  loop
    -- Envolver uma chamada que JÁ esteja envolvida não faz mal nenhum
    -- (`(select (select auth.uid()))` continua a ser um InitPlan), mas
    -- evita-se à mesma para os textos ficarem legíveis.
    nova_qual := p.qual;
    nova_check := p.with_check;

    if nova_qual is not null and nova_qual !~ 'select auth\.' then
      nova_qual := replace(replace(replace(nova_qual,
        'auth.uid()',  '(select auth.uid())'),
        'auth.jwt()',  '(select auth.jwt())'),
        'auth.role()', '(select auth.role())');
    end if;

    if nova_check is not null and nova_check !~ 'select auth\.' then
      nova_check := replace(replace(replace(nova_check,
        'auth.uid()',  '(select auth.uid())'),
        'auth.jwt()',  '(select auth.jwt())'),
        'auth.role()', '(select auth.role())');
    end if;

    -- Nada mudou nesta? Segue.
    if nova_qual is not distinct from p.qual
       and nova_check is not distinct from p.with_check then
      continue;
    end if;

    -- `alter policy` só troca as expressões. O comando e os papéis ficam
    -- exactamente como estavam — é por isso que se usa isto e não drop+create.
    if nova_qual is not null and nova_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)',
                     p.policyname, p.schemaname, p.tablename, nova_qual, nova_check);
    elsif nova_qual is not null then
      execute format('alter policy %I on %I.%I using (%s)',
                     p.policyname, p.schemaname, p.tablename, nova_qual);
    elsif nova_check is not null then
      execute format('alter policy %I on %I.%I with check (%s)',
                     p.policyname, p.schemaname, p.tablename, nova_check);
    end if;

    n := n + 1;
    raise notice '  %.% → %', p.tablename, p.policyname, 'ok';
  end loop;

  raise notice '% política(s) passaram a calcular auth.uid() uma só vez.', n;
end $$;
*/


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 3 — CONFIRMAR. Depois de aplicares, isto deve devolver ZERO linhas.
-- ════════════════════════════════════════════════════════════════════════════
-- select tablename, policyname
--   from pg_policies
--  where schemaname = 'public'
--    and (qual ~ 'auth\.(uid|jwt|role)\(\)' or with_check ~ 'auth\.(uid|jwt|role)\(\)')
--    and coalesce(qual, '') !~ 'select auth\.';


-- ── E DEPOIS DE CORRER: TESTA O ACESSO ─────────────────────────────────────
-- Isto mexeu em políticas. Não basta o Advisor ficar verde — tem de se
-- confirmar que ninguém perdeu nem ganhou acesso:
--
--   node scripts/check-leitura-anonima.mjs
--
-- e entra na app com a conta de QA e abre /patients, /mar e /historico. Se
-- alguma lista aparecer vazia quando devia ter dados, diz-me: quer dizer que
-- uma política ficou mais apertada do que estava, e desfaz-se.
--
-- ── NOTA SOBRE OS FICHEIROS DO REPOSITÓRIO ─────────────────────────────────
-- Os 155 sprint*.sql continuam a criar políticas na forma antiga. Como todos
-- têm `exception when duplicate_object then null`, voltar a corrê-los NÃO
-- desfaz esta correção — as políticas já existem e são ignoradas. Mas se algum
-- dia recriares a base do zero, ela nasce outra vez com o problema. Quando
-- mexeres num desses ficheiros, escreve `(select auth.uid())`.
