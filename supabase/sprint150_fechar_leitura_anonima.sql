-- sprint150_fechar_leitura_anonima.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: LÊ ISTO TODO ANTES DE CORRER. É a correção mais importante que te
-- mandei até hoje. Corre tudo de uma vez, no SQL Editor.
--
-- ── O QUE SE PASSA ──────────────────────────────────────────────────────────
-- Uma VISTA em Postgres corre, por omissão, com os privilégios de quem a
-- CRIOU — não de quem a consulta. Por isso **ignora a RLS das tabelas por
-- baixo**. O `org_active_patients` lê a tabela `patients`, que tem RLS bem
-- feita; a RLS não serviu de nada, porque a vista passou-lhe por cima.
--
-- É isto que o Security Advisor do Supabase marca como "Security Definer View",
-- e por isso é que está tudo a CRITICAL.
--
-- Testei com a chave `anon` (a que está no código do site) e SEM sessão
-- nenhuma. Das 233 tabelas expostas, 15 responderam com dados:
--
--   org_audit_feed       67 linhas   o registo de atividade  [VISTA]
--   arena_attempts       28 linhas   quem respondeu o quê
--   personal_meds        11 linhas   a medicação de toda a gente
--   org_active_patients   8 linhas   nome, idade, sexo, peso, creatinina  [VISTA]
--   emergency_tokens      4 linhas   token, ALERGIAS, grupo sanguíneo, contacto
--   profiles              3 linhas   o EMAIL de toda a gente
--   arena_leaderboard     3 linhas   [VISTA]
--   + phlox_links (códigos de partilha), clinical_consults, organizations,
--     grand_round_*, ward_occupancy [VISTA], supplier_kpis [VISTA]
--
-- E três vistas abertas que hoje estão vazias — o buraco é o mesmo, só ainda
-- não tem lá nada: current_open_episode (episódios clínicos), crm_pipeline,
-- unified_waitlist.
--
-- ── PORQUE É QUE ISTO NÃO ENUMERA AS VISTAS À MÃO ──────────────────────────
-- A minha primeira versão tinha uma lista escrita a mão, tirada dos ficheiros
-- .sql do repositório. Faltava-lhe o `arena_leaderboard` — que existe na base
-- de dados e não está em ficheiro nenhum (foi criado à mão algures). Uma lista
-- escrita a mão só protege o que alguém se lembrou de lá pôr.
--
-- Por isso a secção 1 percorre TODAS as vistas do schema `public`, venham de
-- onde vierem. Corre-a outra vez daqui a seis meses e continua correcta.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. TODAS as vistas passam a respeitar a RLS de quem pergunta ────────────
-- `security_invoker = true` faz a vista correr com os direitos de quem a
-- consulta, em vez dos de quem a criou. É a cura exacta do "Security Definer
-- View". Precisa de Postgres 15+ (o Supabase já está acima disso).
do $$
declare
  v record;
  n int := 0;
begin
  for v in
    select schemaname, viewname
      from pg_views
     where schemaname = 'public'
  loop
    execute format('alter view public.%I set (security_invoker = true)', v.viewname);
    n := n + 1;
    raise notice '  vista corrigida: %', v.viewname;
  end loop;
  raise notice '%  vista(s) passaram a respeitar a RLS.', n;
end $$;

-- As vistas MATERIALIZADAS não suportam `security_invoker` — guardam as linhas
-- e devolvem-nas a quem tiver permissão, ponto. A única defesa é a permissão.
do $$
declare
  v record;
begin
  for v in
    select matviewname from pg_matviews where schemaname = 'public'
  loop
    execute format('revoke select on public.%I from anon', v.matviewname);
    raise notice '  vista materializada fechada ao anon: %', v.matviewname;
  end loop;
end $$;


-- ── 2. Quem não tem sessão deixa de ler dados de pessoas ────────────────────
-- Só `revoke ... from anon`. NÃO mexo em nenhuma política: quem está
-- autenticado fica exactamente como estava. Se alguma coisa parar depois
-- disto, é porque estava a ser lida sem sessão — e isso era o problema.
--
-- Verifiquei uma a uma que fechar não parte nada:
--   • emergency_tokens e phlox_links → só lidas por rotas de API, com a chave
--     de serviço. O cartão de emergência e os links continuam a funcionar.
--   • org_active_patients e org_audit_feed → não são usadas por código nenhum.
--   • personal_meds, clinical_consults, arena_attempts → lidas do browser COM
--     sessão.
revoke select on personal_meds        from anon;
revoke select on emergency_tokens     from anon;
revoke select on phlox_links          from anon;
revoke select on clinical_consults    from anon;
revoke select on arena_attempts       from anon;
revoke select on organizations        from anon;
revoke select on grand_round_cases    from anon;
revoke select on grand_round_comments from anon;
revoke select on grand_round_votes    from anon;

-- E as vistas, por cinto e suspensórios: uma vista sobre uma tabela SEM RLS
-- continuaria a devolver tudo mesmo com `security_invoker`.
revoke select on org_active_patients  from anon;
revoke select on org_audit_feed       from anon;
revoke select on ward_occupancy       from anon;
revoke select on supplier_kpis        from anon;
revoke select on arena_leaderboard    from anon;
revoke select on current_open_episode from anon;
revoke select on crm_pipeline         from anon;
revoke select on unified_waitlist     from anon;


-- ── 3. O que PODE mesmo ser público, e porquê ──────────────────────────────
-- Isto é conteúdo de referência: não tem dados de ninguém, e são as páginas
-- que o Google indexa e que trazem gente ao site. Fica aberto de propósito.
--   lab_value_library, medical_library, procedure_guides, ecg_library,
--   infarmed_drugs, infarmed_drugs_stats, infarmed_shortage_list,
--   infarmed_shortage_sync, infarmed_recall_notices
-- Confirmado coluna a coluna.


-- ── 4. `profiles` — DECIDIDO (2026-09-24) ──────────────────────────────────
-- O Fernando escolheu fechar, e o `/admin` passou a ler por uma rota de
-- servidor (app/api/admin/painel) em vez de ir direto do browser. Já não há
-- nada do lado do cliente a precisar de ler perfis de outras pessoas sem
-- sessão.
revoke select on profiles from anon;


-- ── 5. Confirma que ficou fechado ──────────────────────────────────────────
-- Corre isto a seguir, aqui mesmo. Deve devolver ZERO linhas.
select table_name
  from information_schema.role_table_grants
 where grantee = 'anon'
   and privilege_type = 'select'
   and table_schema = 'public'
   and table_name in (
     'personal_meds','emergency_tokens','phlox_links','clinical_consults',
     'arena_attempts','organizations','org_active_patients','org_audit_feed',
     'ward_occupancy','supplier_kpis','arena_leaderboard','current_open_episode',
     'crm_pipeline','unified_waitlist','grand_round_cases','grand_round_comments',
     'grand_round_votes','profiles'
   );

-- E no terminal do teu computador:
--   node scripts/check-leitura-anonima.mjs
-- Deve dizer que nenhuma tabela com dados responde sem sessão.
