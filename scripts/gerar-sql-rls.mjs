// scripts/gerar-sql-rls.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Escreve as politicas de RLS por AREA, a partir de lib/areasDeDados.ts.
//
// ── PORQUE E QUE ISTO E A PECA QUE FALTAVA ─────────────────────────────────
// Ate aqui a defesa das permissoes vivia na interface (esconder botoes) e nas
// rotas de API. Isso protege contra um utilizador distraido, nao contra um
// utilizador com a consola do browser aberta: o cliente do Supabase fala
// DIRETAMENTE com a base de dados a partir da pagina, e a chave anon esta la.
//
// Uma auxiliar que abra a consola e escreva
//     supabase.from('billing_entries').select('*')
// le as mensalidades de todas as familias -- a menos que a RLS diga que nao.
//
// A RLS e a unica defesa que nao se contorna. As outras sao conforto.
//
// ── PORQUE E QUE AS POLITICAS SAO *RESTRITIVAS* ────────────────────────────
// A primeira versao deste gerador largava as politicas existentes e punha as
// suas no lugar. Estava errado, por duas razoes que so se veem a olhar para o
// que la esta:
//
//   • as politicas atuais destas tabelas sao `user_id = auth.uid()` -- por
//     pessoa, nao por organizacao. Substitui-las por uma politica de
//     organizacao ALARGAVA o acesso em vez de o restringir;
//   • e ha caminhos que eu nao consigo enumerar de fora: uma familia a ler o
//     seu fio, um codigo de partilha, um convite. Largar tudo partia-os sem
//     eu saber.
//
// Em RLS, as politicas normais (permissivas) somam-se com OU: acrescentar uma
// mais apertada nao aperta nada. Mas uma politica marcada `as restrictive`
// soma-se com E -- e passa a ser uma condicao que TODAS as outras tem de
// respeitar tambem.
//
// E exatamente o que uma area e: uma condicao adicional. Por isso nada se
// larga. O que ja existe continua a decidir quem chega aos dados; a politica
// restritiva acrescenta "e tem de ter a permissao desta area".
//
// Linhas pessoais (`org_id is null`) passam sempre pela restritiva, e quem
// decide sobre elas continua a ser a politica que ja la estava.
//
// ── E FALHA FECHADO ────────────────────────────────────────────────────────
// Com RLS ligada e sem politica que autorize, o Postgres recusa. Se eu mapear
// uma tabela para a area errada, a ferramenta deixa de funcionar -- chato, e
// visivel no minuto seguinte. O erro contrario (abrir dados sem ninguem dar
// por isso) e o que nao se pode correr.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/gerar-sql-rls.mjs --escrever
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/gerar-sql-rls.mjs --verificar
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import { AREA_DA_TABELA, SEM_AREA } from '../lib/areasDeDados.ts'
import { POR_AREA } from '../lib/permissoes.ts'

const DESTINO = 'supabase/sprint153_rls_por_area.sql'

const pares = Object.entries(AREA_DA_TABELA).sort(([a], [b]) => a.localeCompare(b))
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`

// Cada tabela leva as tres chaves que interessam. Uma area sem `eliminar`
// (por exemplo `qualidade`) deixa essa vazia, e o gerador nao cria a politica.
const linhas = pares.map(([tabela, area]) => {
  const a = POR_AREA.get(area)
  const ver = a.niveis.includes('ver') ? lit(`${area}.ver`) : 'null'
  const editar = a.niveis.includes('editar') ? lit(`${area}.editar`) : 'null'
  const eliminar = a.niveis.includes('eliminar') ? lit(`${area}.eliminar`) : 'null'
  return `    [${lit(tabela)}, ${ver}, ${editar}, ${eliminar}]`
}).join(',\n')

const sql = `-- ${DESTINO}
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRE ISTO NO SUPABASE (SQL EDITOR), DEPOIS do sprint152.
--
-- ⚠ ESTE FICHEIRO E GERADO. Nao o edites a mao.
--   Muda lib/areasDeDados.ts e corre:
--     node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/gerar-sql-rls.mjs --escrever
--
-- ── O QUE ISTO FAZ, E PORQUE E QUE E A PECA QUE FALTAVA ────────────────────
-- Ate aqui as permissoes viviam na interface e nas rotas. Isso protege contra
-- um utilizador distraido, nao contra um com a consola do browser aberta: o
-- cliente do Supabase fala DIRETAMENTE com a base de dados a partir da pagina.
--
-- Uma auxiliar que escreva na consola
--     supabase.from('billing_entries').select('*')
-- le as mensalidades de todas as familias -- a menos que a RLS diga que nao.
-- E a unica defesa que nao se contorna.
--
-- ${pares.length} tabelas ganham politicas por area. ${Object.keys(SEM_AREA).length} ficam de fora, de
-- proposito e com a razao escrita em lib/areasDeDados.ts.
--
-- ── NADA E LARGADO ─────────────────────────────────────────────────────────
-- Estas politicas sao \`as restrictive\`: em RLS as normais somam-se com OU (e
-- por isso acrescentar uma mais apertada nao apertaria nada), mas uma
-- restritiva soma-se com E -- vira uma condicao que todas as outras tem de
-- respeitar tambem.
--
-- Ou seja: o que ja existe continua a decidir quem chega aos dados (o ambito
-- por organizacao, o acesso de uma familia ao seu fio, um codigo de partilha),
-- e isto acrescenta por cima "e tem de ter a permissao desta area".
--
-- Linhas pessoais (\`org_id is null\`) passam sempre, e quem decide sobre elas
-- continua a ser a politica que ja la estava. O modo pessoal nao e tocado.
--
-- ── FALHA FECHADO ──────────────────────────────────────────────────────────
-- Se uma tabela estiver mapeada para a area errada, a ferramenta deixa de
-- funcionar -- chato, e visivel no minuto seguinte. O erro contrario (abrir
-- dados sem ninguem dar por isso) e o que nao se pode correr. Depois de
-- aplicares, abre /patients, /mar, /incidents e /faturacao e diz-me se alguma
-- lista aparecer vazia.
--
-- ── DESFAZER ───────────────────────────────────────────────────────────────
-- No fim do ficheiro ha o bloco que repoe o acesso simples por organizacao,
-- comentado. Se alguma coisa parar e precisares da casa a funcionar ja,
-- corre-o: perdes a restricao por area, ficas com o que tinhas antes.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  tem_org     boolean;
  pol         record;
  n_tab       int := 0;
  n_pol       int := 0;
  mapa        text[][] := array[
${linhas}
  ];
  i int;
begin
  for i in 1 .. array_length(mapa, 1) loop
    -- A tabela existe mesmo? Uma instalacao parcial nao pode fazer isto parar.
    if to_regclass('public.' || mapa[i][1]) is null then
      raise notice '  (salta) % nao existe', mapa[i][1];
      continue;
    end if;

    select exists(
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = mapa[i][1] and column_name = 'org_id'
    ) into tem_org;
    if not tem_org then
      raise notice '  (salta) % nao tem org_id', mapa[i][1];
      continue;
    end if;

    execute format('alter table public.%I enable row level security', mapa[i][1]);

    -- So as NOSSAS saem, para isto poder correr duas vezes sem duplicar. As
    -- politicas que ja la estavam ficam intactas -- e e esse o ponto.
    for pol in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = mapa[i][1]
         and policyname like '%\_area\_%'
    loop
      execute format('drop policy %I on public.%I', pol.policyname, mapa[i][1]);
      n_pol := n_pol + 1;
    end loop;

    -- ── VER ────────────────────────────────────────────────────────────────
    if mapa[i][2] is not null then
      execute format($f$
        create policy %I on public.%I as restrictive for select using (
          org_id is null
          or org_id in (
            select org_id from org_members
             where user_id = (select auth.uid()) and active = true
               and %L = any(coalesce(capabilities, default_capabilities(role)))
          )
        )$f$, mapa[i][1] || '_area_ver', mapa[i][1], mapa[i][2]);
    end if;

    -- ── EDITAR (criar e alterar) ──────────────────────────────────────────
    if mapa[i][3] is not null then
      execute format($f$
        create policy %I on public.%I as restrictive for insert with check (
          org_id is null
          or org_id in (
            select org_id from org_members
             where user_id = (select auth.uid()) and active = true
               and %L = any(coalesce(capabilities, default_capabilities(role)))
          )
        )$f$, mapa[i][1] || '_area_criar', mapa[i][1], mapa[i][3]);

      execute format($f$
        create policy %I on public.%I as restrictive for update using (
          org_id is null
          or org_id in (
            select org_id from org_members
             where user_id = (select auth.uid()) and active = true
               and %L = any(coalesce(capabilities, default_capabilities(role)))
          )
        )$f$, mapa[i][1] || '_area_alterar', mapa[i][1], mapa[i][3]);
    end if;

    -- ── ELIMINAR ──────────────────────────────────────────────────────────
    -- Atencao ao contrario: com politicas RESTRITIVAS, nao criar nenhuma NAO
    -- proibe -- deixa as permissivas decidirem sozinhas. Por isso uma area sem
    -- nivel de eliminar (o registo de atividade, a qualidade) ganha aqui uma
    -- politica que PROIBE apagar qualquer linha de uma casa.
    --
    -- No registo de atividade isso e o ponto todo: um historico que se pode
    -- apagar nao serve de historico, e e o que a inspecao vem ver.
    if mapa[i][4] is null then
      execute format($f$
        create policy %I on public.%I as restrictive for delete using (org_id is null)
      $f$, mapa[i][1] || '_area_eliminar_nunca', mapa[i][1]);
    end if;

    if mapa[i][4] is not null then
      execute format($f$
        create policy %I on public.%I as restrictive for delete using (
          org_id is null
          or org_id in (
            select org_id from org_members
             where user_id = (select auth.uid()) and active = true
               and %L = any(coalesce(capabilities, default_capabilities(role)))
          )
        )$f$, mapa[i][1] || '_area_eliminar', mapa[i][1], mapa[i][4]);
    end if;

    n_tab := n_tab + 1;
  end loop;

  raise notice '';
  raise notice '% tabelas protegidas por area (% politicas antigas substituidas).', n_tab, n_pol;
end $$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- Deve devolver uma linha por tabela, com 2 a 4 politicas cada.
--
--   select tablename, count(*) as politicas
--     from pg_policies
--    where schemaname = 'public' and policyname like '%_area_%'
--    group by tablename order by tablename;
--
-- E no teu computador:
--   node scripts/check-leitura-anonima.mjs
--   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-areas.mjs
--
-- Depois entra na app e abre /patients, /mar, /incidents, /faturacao e
-- /historico. Se alguma lista aparecer vazia quando devia ter dados, e uma
-- area mal mapeada: diz-me qual e eu corrijo lib/areasDeDados.ts.


-- ── DESFAZER, se for preciso a casa a funcionar ja ──────────────────────────
-- Larga SO as politicas criadas aqui. Como nada foi substituido, a casa volta
-- exatamente ao que era antes deste ficheiro -- sem restricao por area, com o
-- acesso que ja tinha.
/*
do $$
declare pol record; n int := 0;
begin
  for pol in
    select tablename, policyname from pg_policies
     where schemaname = 'public' and policyname like '%_area_%'
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
    n := n + 1;
  end loop;
  raise notice '% politicas de area largadas.', n;
end $$;
*/
`

if (process.argv.includes('--escrever')) {
  fs.writeFileSync(DESTINO, sql)
  console.log(`Escrito: ${DESTINO} (${sql.split('\n').length} linhas, ${pares.length} tabelas)`)
} else if (process.argv.includes('--verificar')) {
  let atual = ''
  try { atual = fs.readFileSync(DESTINO, 'utf8') } catch {
    console.log(`✗ ${DESTINO} nao existe. Corre com --escrever.`)
    process.exit(1)
  }
  if (atual.trim() === sql.trim()) {
    console.log('✓ A RLS por area esta em sincronia com lib/areasDeDados.ts.')
    process.exit(0)
  }
  console.log(`✗ ${DESTINO} diverge de lib/areasDeDados.ts.`)
  console.log('  Corre com --escrever e aplica a migracao.')
  process.exit(1)
} else {
  console.log(sql)
}
