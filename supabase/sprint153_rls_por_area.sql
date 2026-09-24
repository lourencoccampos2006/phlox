-- supabase/sprint153_rls_por_area.sql
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
-- 69 tabelas ganham politicas por area. 26 ficam de fora, de
-- proposito e com a razao escrita em lib/areasDeDados.ts.
--
-- ── NADA E LARGADO ─────────────────────────────────────────────────────────
-- Estas politicas sao `as restrictive`: em RLS as normais somam-se com OU (e
-- por isso acrescentar uma mais apertada nao apertaria nada), mas uma
-- restritiva soma-se com E -- vira uma condicao que todas as outras tem de
-- respeitar tambem.
--
-- Ou seja: o que ja existe continua a decidir quem chega aos dados (o ambito
-- por organizacao, o acesso de uma familia ao seu fio, um codigo de partilha),
-- e isto acrescenta por cima "e tem de ter a permissao desta area".
--
-- Linhas pessoais (`org_id is null`) passam sempre, e quem decide sobre elas
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
    ['activities', 'atividades.ver', 'atividades.editar', 'atividades.eliminar'],
    ['activity_log', 'registo_atividade.ver', null, null],
    ['activity_participations', 'atividades.ver', 'atividades.editar', 'atividades.eliminar'],
    ['adl_reviews', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['assessments', 'avaliacoes.ver', 'avaliacoes.editar', 'avaliacoes.eliminar'],
    ['attendance', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['beds', null, 'definicoes.editar', null],
    ['billing_entries', 'financeiro.ver', 'financeiro.editar', 'financeiro.eliminar'],
    ['care_checklist_logs', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['care_checklists', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['care_plans', 'utentes.ver', 'utentes.editar', 'utentes.eliminar'],
    ['care_records', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['compliance_items', 'qualidade.ver', null, null],
    ['consents', 'documentos.ver', 'documentos.editar', 'documentos.eliminar'],
    ['cuidados_nao_prestados', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['dietary_reinforcements', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['documents', 'documentos.ver', 'documentos.editar', 'documentos.eliminar'],
    ['family_messages', 'familias.ver', 'familias.editar', null],
    ['family_thread_messages', 'familias.ver', 'familias.editar', null],
    ['finance_entries', 'financeiro.ver', 'financeiro.editar', 'financeiro.eliminar'],
    ['goods_receipts', 'stock.ver', 'stock.editar', 'stock.eliminar'],
    ['handovers', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['health_checkins', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['hydration_logs', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['incidents', 'ocorrencias.ver', 'ocorrencias.editar', 'ocorrencias.eliminar'],
    ['institution_settings', null, 'definicoes.editar', null],
    ['kpi_snapshots', 'qualidade.ver', null, null],
    ['mar_records', 'medicacao.ver', 'medicacao.editar', 'medicacao.eliminar'],
    ['meal_dishes', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['meal_plan_entries', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['medication_prep_logs', 'medicacao.ver', 'medicacao.editar', 'medicacao.eliminar'],
    ['patient_channels', 'utentes.ver', 'utentes.editar', 'utentes.eliminar'],
    ['patient_meds', 'medicacao.ver', 'medicacao.editar', 'medicacao.eliminar'],
    ['patient_vigilance', 'medicacao.ver', 'medicacao.editar', 'medicacao.eliminar'],
    ['patients', 'utentes.ver', 'utentes.editar', 'utentes.eliminar'],
    ['plano_acoes', 'utentes.ver', 'utentes.editar', 'utentes.eliminar'],
    ['plano_avaliacoes', 'utentes.ver', 'utentes.editar', 'utentes.eliminar'],
    ['plano_execucoes', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['plano_objetivos', 'utentes.ver', 'utentes.editar', 'utentes.eliminar'],
    ['planos', 'utentes.ver', 'utentes.editar', 'utentes.eliminar'],
    ['psychosocial_notes', 'avaliacoes.ver', 'avaliacoes.editar', 'avaliacoes.eliminar'],
    ['purchase_orders', 'stock.ver', 'stock.editar', 'stock.eliminar'],
    ['recurring_activities', 'atividades.ver', 'atividades.editar', 'atividades.eliminar'],
    ['resident_contacts', 'utentes.ver', 'utentes.editar', 'utentes.eliminar'],
    ['resident_requests', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['round_assignments', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['rounds', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['safety_events', 'ocorrencias.ver', 'ocorrencias.editar', 'ocorrencias.eliminar'],
    ['sales', 'financeiro.ver', 'financeiro.editar', 'financeiro.eliminar'],
    ['shift_assignments', 'equipa.ver', 'equipa.editar', 'equipa.eliminar'],
    ['shift_checkins', 'equipa.ver', 'equipa.editar', 'equipa.eliminar'],
    ['shift_vacancies', 'equipa.ver', 'equipa.editar', 'equipa.eliminar'],
    ['stock_consumption', 'stock.ver', 'stock.editar', 'stock.eliminar'],
    ['stock_items', 'stock.ver', 'stock.editar', 'stock.eliminar'],
    ['suppliers', 'stock.ver', 'stock.editar', 'stock.eliminar'],
    ['support_recurring_services', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['support_services', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['support_transport_logs', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['support_transport_routes', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['support_transport_schedules', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['team_members', 'equipa.ver', 'equipa.editar', 'equipa.eliminar'],
    ['team_messages', 'equipa.ver', 'equipa.editar', 'equipa.eliminar'],
    ['team_reads', 'equipa.ver', 'equipa.editar', 'equipa.eliminar'],
    ['team_spaces', 'equipa.ver', 'equipa.editar', 'equipa.eliminar'],
    ['team_tasks', 'equipa.ver', 'equipa.editar', 'equipa.eliminar'],
    ['visit_requests', 'familias.ver', 'familias.editar', null],
    ['vitals', 'registos.ver', 'registos.editar', 'registos.eliminar'],
    ['wards', null, 'definicoes.editar', null],
    ['wounds', 'feridas.ver', 'feridas.editar', 'feridas.eliminar']
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
         and policyname like '%_area_%'
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
