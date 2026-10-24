-- sprint188_conformidade_chaves.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- A CHECKLIST DE CONFORMIDADE MUDOU DE CHAVES — E O TRABALHO JÁ FEITO FICA.
--
-- ── O QUE ACONTECE SEM ISTO ────────────────────────────────────────────────
-- A checklist passou de quinze itens para trinta e tal, seguindo a Portaria
-- n.º 67/2012 artigo a artigo. Duas obrigações mudaram de nome pelo caminho:
--
--     erpi_dietas  →  erpi_ementas
--     erpi_pic     →  erpi_pdi
--
-- A página lê as linhas da `compliance_items` pela CHAVE. Uma casa que já
-- tivesse marcado essas duas como conformes abria a página e via-as pendentes
-- outra vez — sem explicação, e com a nota que lá tivesse escrito a
-- desaparecer. Numa ferramenta de conformidade isso é pior do que uma
-- pendência a mais: faz duvidar de tudo o resto que lá está marcado.
--
-- ── O QUE SAI, E PORQUÊ ────────────────────────────────────────────────────
-- Uma obrigação foi REMOVIDA e não renomeada: `rgpd_consentimento`
-- («consentimento informado documentado»). Estava errada.
--
-- A base legal do tratamento de dados de saúde num lar é o art. 9.º/2-h — e
-- não o consentimento. O consentimento tem de ser livre e retirável, e nenhuma
-- das duas coisas é verdade aqui: a Portaria n.º 67/2012 obriga a casa a manter
-- processo individual, registo de medicação e registo de ocorrências mesmo que
-- a pessoa peça para os apagar. Pedir a uma casa que documente um consentimento
-- que não pode honrar é pedir-lhe que escreva uma promessa falsa.
--
-- No lugar entra `rgpd_base_legal`, que verifica o contrário: que a casa assenta
-- o tratamento na base CERTA.
--
-- A linha antiga NÃO se apaga. Fica inerte — a página só lê as chaves que
-- conhece — e quem for ver a tabela daqui a um ano percebe que existiu. Apagar
-- o estado de uma obrigação que alguém reviu e assinou é deitar fora o registo
-- de que a reviu.
--
-- Seguro de correr mais do que uma vez.
-- ---------------------------------------------------------------------------

-- ── 1. Os dois que mudaram de nome ──────────────────────────────────────────
-- O `where not exists` evita o conflito com a unicidade `(org_id, key)`: se
-- alguém já marcou a chave NOVA, é essa que vale e a antiga fica onde está.
update public.compliance_items a
   set key = 'erpi_ementas'
 where a.key = 'erpi_dietas'
   and not exists (
     select 1 from public.compliance_items b
      where b.key = 'erpi_ementas'
        and b.org_id is not distinct from a.org_id
        and b.user_id is not distinct from a.user_id
   );

update public.compliance_items a
   set key = 'erpi_pdi'
 where a.key = 'erpi_pic'
   and not exists (
     select 1 from public.compliance_items b
      where b.key = 'erpi_pdi'
        and b.org_id is not distinct from a.org_id
        and b.user_id is not distinct from a.user_id
   );

-- ── 2. Deixar dito o que aconteceu ao que saiu ──────────────────────────────
-- Uma nota na própria linha, para quem a encontrar não pensar que é um erro.
update public.compliance_items
   set note = coalesce(nullif(trim(note), '') || ' · ', '')
            || 'Obrigação retirada da checklist a 21/10/2026: a base legal dos '
            || 'dados de saúde num lar é o art. 9.º/2-h do RGPD e não o '
            || 'consentimento. Substituída por «Base legal correta para os dados '
            || 'de saúde».'
 where key = 'rgpd_consentimento'
   and (note is null or note not like '%Obrigação retirada da checklist%');

-- ── Verificar ───────────────────────────────────────────────────────────────
--   select key, count(*) from compliance_items
--    where key in ('erpi_dietas','erpi_ementas','erpi_pic','erpi_pdi','rgpd_consentimento')
--    group by key order by key;

notify pgrst, 'reload schema';
