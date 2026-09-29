-- supabase/sprint164_permissoes_finas.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint163, e o sprint153 a seguir.
--
-- ── O QUE PEDISTE ───────────────────────────────────────────────────────────
-- «As permissões ainda não estão da maneira que é preciso. Personalização
-- extrema, faz mesmo um exagero — por exemplo, dentro da mesma ferramenta duas
-- pessoas não verem sequer as mesmas coisas.»
--
-- O que existia resolvia «pode abrir esta ferramenta?». Faltavam duas coisas,
-- e esta migração traz a segunda (a primeira é só código — ver os DETALHES em
-- lib/permissoes.ts).
--
-- ── QUE UTENTES É QUE ESTA PESSOA VÊ ───────────────────────────────────────
-- Num lar de sessenta pessoas, a auxiliar do piso 1 não tem nada que ver com
-- os registos, a medicação e as ocorrências do piso 2. Hoje vê tudo.
--
-- A restrição usa as ETIQUETAS (sprint163): «esta pessoa só vê os utentes com
-- a etiqueta Piso 1». E isso é melhor do que uma lista de nomes por duas
-- razões. Primeira: uma lista de nomes fica desatualizada na admissão
-- seguinte, e ninguém se lembra de a ir corrigir. Segunda: quando alguém muda
-- de piso, muda-se a etiqueta DESSA pessoa e toda a equipa fica certa de uma
-- vez.
--
-- `utentes_etiquetas` vazio ou nulo = vê todos. É o que toda a gente tem hoje,
-- e é o que continua a ter até alguém decidir o contrário.
--
-- ── A RLS VAI A TODAS AS TABELAS COM `patient_id` ──────────────────────────
-- Limitar só a tabela `patients` não serve de nada: quem não vê a pessoa
-- continuaria a ler-lhe a medicação, os registos e as ocorrências escrevendo
-- `supabase.from('mar_records').select('*')` na consola.
--
-- Por isso o sprint153 (que é gerado) passou a emitir também, para CADA tabela
-- que tenha `patient_id`, uma política que diz: ou não tens restrição, ou
-- aquela pessoa tem uma das tuas etiquetas.
--
-- ── O DONO NUNCA SE RESTRINGE ──────────────────────────────────────────────
-- Está no código e está aqui: a mesma garantia de que ninguém fica fechado
-- fora da sua própria casa.
-- ─────────────────────────────────────────────────────────────────────────────

alter table org_members
  add column if not exists utentes_etiquetas uuid[];

comment on column org_members.utentes_etiquetas is
  'Vazio ou nulo = ve todos os utentes da casa. Com etiquetas, so ve quem tiver pelo menos uma delas (sprint164). A RLS que o impoe e gerada pelo sprint153.';

-- A política vai percorrer isto por cada linha de `patients`; sem índice, uma
-- casa de sessenta pessoas faz sessenta varreduras por consulta.
create index if not exists org_members_etiquetas_idx
  on org_members using gin (utentes_etiquetas)
  where utentes_etiquetas is not null;


-- ── A função que responde à pergunta ────────────────────────────────────────
-- Numa função, e não escrita em cada política: são setenta e tal tabelas, e
-- setenta e tal cópias da mesma regra é setenta e tal sítios para uma delas
-- ficar diferente das outras.
--
-- `stable` porque, dentro da mesma consulta, a resposta não muda — e isso
-- permite ao Postgres chamá-la uma vez em vez de uma vez por linha.
--
-- `security definer` porque precisa de ler `org_members` e
-- `etiquetas_do_utente` mesmo para quem não os pode consultar diretamente.
create or replace function ve_este_utente(p_utente uuid, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Sem casa (modo pessoal) não há restrição nenhuma a aplicar.
    p_org is null
    or exists (
      select 1 from org_members m
       where m.org_id = p_org
         and m.user_id = (select auth.uid())
         and m.active = true
         and (
           -- O dono vê sempre tudo. É a garantia de que ninguém fica fechado
           -- fora da sua própria casa, e repete-se aqui de propósito.
           m.role in ('dono', 'owner')
           -- Sem etiquetas escolhidas, vê todos.
           or m.utentes_etiquetas is null
           or array_length(m.utentes_etiquetas, 1) is null
           -- Com etiquetas, o utente tem de ter pelo menos uma delas.
           or exists (
             select 1 from etiquetas_do_utente e
              where e.patient_id = p_utente
                and e.etiqueta_id = any(m.utentes_etiquetas)
           )
         )
    );
$$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- A coluna ficou:
--   select column_name from information_schema.columns
--    where table_name = 'org_members' and column_name = 'utentes_etiquetas';
--
-- A função responde (sem restrições, deve dar `true` para qualquer utente):
--   select ve_este_utente(id, org_id) from patients limit 3;
--
-- Depois corre o sprint153, que é o que põe isto a valer nas tabelas todas.
