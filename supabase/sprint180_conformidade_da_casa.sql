-- sprint180_conformidade_da_casa.sql
-- ---------------------------------------------------------------------------
-- A CHECKLIST DE CONFORMIDADE É DA CASA, NÃO DE QUEM A ABRE.
--
-- ── O QUE ESTÁ MAL HOJE ────────────────────────────────────────────────────
-- A tabela `compliance_items` nasceu no sprint32 com `unique (user_id, key)`,
-- de um tempo em que uma conta era uma pessoa. O sprint115 acrescentou-lhe
-- `org_id`, mas a restrição de unicidade ficou como estava.
--
-- Consequência real, numa casa com mais do que um gestor: a Direção Técnica
-- marca o RGPD como conforme e cria a SUA linha; o administrador abre a mesma
-- página e, como a leitura era por `user_id`, continua a ver «pendente» — e
-- marca outra vez, criando uma SEGUNDA linha para a mesma obrigação.
--
-- Numa auditoria isso é o pior dos mundos: o trabalho foi feito e não se
-- consegue provar qual é o estado da casa.
--
-- A página já foi corrigida na parte que não precisa de migração: lê a casa
-- toda e, havendo várias linhas para a mesma obrigação, mostra a mais recente.
-- Esta migração fecha o resto.
--
-- ── O QUE ISTO FAZ ─────────────────────────────────────────────────────────
--  1. Junta as linhas duplicadas: para cada (org_id, key) fica a mais
--     recente, e as outras são apagadas. Nada se perde que não estivesse já
--     invisível — a página mostrava exactamente essa.
--  2. Troca a unicidade de `(user_id, key)` por `(org_id, key)` nas contas
--     COM organização, mantendo `(user_id, key)` para as que não têm.
--     Dois índices parciais, porque uma casa sem organização continua a
--     funcionar por `user_id` como sempre funcionou.
--
-- ── NÃO APAGA NADA QUE AINDA SEJA ÚNICO ────────────────────────────────────
-- O `delete` só toca em linhas que tenham uma irmã mais recente com o mesmo
-- `org_id` e a mesma `key`. Numa casa com um gestor só, não apaga nada.
-- ---------------------------------------------------------------------------

-- O editor do Supabase ja corre cada ficheiro numa transacao: um `begin;`
-- explicito aqui so confunde a guarda que conta blocos, e nao acrescenta nada.

-- ── 1. Carimbar o `org_id` em quem ainda não o tem ─────────────────────────
-- Linhas escritas antes do sprint115 ficaram sem `org_id`. Sem isto, elas
-- nunca entrariam na nova unicidade e continuariam a ser invisíveis.
update public.compliance_items ci
   set org_id = om.org_id
  from public.org_members om
 where ci.org_id is null
   and om.user_id = ci.user_id
   and om.active is true;

-- ── 2. Juntar as duplicadas: por (org_id, key) fica a mais recente ─────────
delete from public.compliance_items a
 using public.compliance_items b
 where a.org_id is not null
   and a.org_id = b.org_id
   and a.key    = b.key
   and a.id    <> b.id
   and (
        a.updated_at < b.updated_at
     or (a.updated_at = b.updated_at and a.id < b.id)   -- desempate estável
   );

-- ── 3. A unicidade passa a ser da casa ─────────────────────────────────────
alter table public.compliance_items
  drop constraint if exists compliance_items_user_id_key_key;

-- Com organização: uma linha por casa e por obrigação.
create unique index if not exists compliance_items_org_key_uidx
  on public.compliance_items (org_id, key)
  where org_id is not null;

-- Sem organização: continua como sempre, uma linha por pessoa.
create unique index if not exists compliance_items_user_key_uidx
  on public.compliance_items (user_id, key)
  where org_id is null;


-- ---------------------------------------------------------------------------
-- DEPOIS DE CORRER ISTO, falta um passo no código: o `upsert` da página usa
-- `onConflict: 'user_id,key'` e tem de passar a escolher a chave conforme a
-- conta tenha ou não organização. Está assinalado em app/conformidade/page.tsx.
-- ---------------------------------------------------------------------------
