-- supabase/sprint179_inqueritos_rls.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto, e A SEGUIR corre o sprint153 outra vez.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- O QUE ESTAVA MAL, E PORQUE É QUE NÃO DEU ERRO NENHUM A MIM
-- ═══════════════════════════════════════════════════════════════════════════
-- O sprint178 escreveu as políticas dos inquéritos contra a tabela errada:
--
--     org_id in (select org_id from team_members where user_id = auth.uid())
--                                 ^^^^^^^^^^^^
--
-- A tabela de PERTENÇA desta aplicação é `org_members`. A `team_members` é
-- outra coisa — é a lista de pessoal da casa, a que serve as escalas, e nem
-- sequer tem de ter o `user_id` de quem entra na aplicação.
--
-- Resultado: a consulta não devolvia nenhuma organização, nenhuma política
-- permissiva deixava passar, e a base de dados recusava a criação com
--
--     42501 — new row violates row-level security policy for table "inqueritos"
--
-- Isto não apareceu em teste nenhum porque, quando escrevi o sprint178, as
-- tabelas ainda não existiam: o ecrã mostrava o aviso de instalação e o
-- percurso completo ficou por verificar — e eu disse-o. O que NÃO fiz foi o
-- mais barato de tudo: olhar para o que as outras dezassete migrações desta
-- casa escrevem na mesma linha. Todas dizem `org_members`.
--
-- ── A SEGUNDA METADE DO MESMO ERRO ─────────────────────────────────────────
-- A área `qualidade` só tinha o nível `ver`. O gerador de RLS lê os níveis da
-- área para saber que políticas escrever — sem `editar`, não escrevia nenhuma
-- de escrita, e mesmo com a política permissiva certa a criação continuaria a
-- ser recusada.
--
-- Isso corrige-se em `lib/permissoes.ts` (já está) e entra pelo sprint153, que
-- é gerado a partir dele. Por isso: ESTE FICHEIRO E DEPOIS O 153.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Fora as erradas ─────────────────────────────────────────────────────────
drop policy if exists inqueritos_da_casa on public.inqueritos;
drop policy if exists respostas_da_casa on public.inqueritos_respostas;


-- ── E as certas ─────────────────────────────────────────────────────────────
-- O mesmo par que o resto da casa usa: uma política para a linha própria
-- (contas sem organização) e outra para a organização. As restritivas do
-- sprint153 somam-se por cima com E, e são elas que decidem QUEM, por área.
do $$
begin
  -- `inqueritos` tem `user_id`; as respostas NÃO TÊM, e é todo o ponto delas.
  begin
    create policy inqueritos_proprio on public.inqueritos for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  exception when duplicate_object then null; end;

  begin
    create policy inqueritos_casa on public.inqueritos for all
      using (org_id is not null and org_id in (
        select org_id from org_members where user_id = (select auth.uid()) and active = true))
      with check (org_id is not null and org_id in (
        select org_id from org_members where user_id = (select auth.uid()) and active = true));
  exception when duplicate_object then null; end;

  -- ── A resposta não tem dono, e por isso só tem a política da casa ────────
  -- Não há aqui nenhuma política «a minha linha»: uma resposta de inquérito
  -- não é de ninguém. Se houvesse um `user_id` para a política usar, o módulo
  -- inteiro deixava de fazer sentido — ver o cabeçalho do sprint178.
  begin
    create policy respostas_casa on public.inqueritos_respostas for all
      using (org_id is not null and org_id in (
        select org_id from org_members where user_id = (select auth.uid()) and active = true))
      with check (org_id is not null and org_id in (
        select org_id from org_members where user_id = (select auth.uid()) and active = true));
  exception when duplicate_object then null; end;
end $$;

revoke select on public.inqueritos from anon;
revoke select on public.inqueritos_respostas from anon;


-- ── Um inquérito com respostas não se apaga ─────────────────────────────────
-- ── PORQUE É QUE ISTO É UMA REGRA DA BASE DE DADOS E NÃO DO ECRÃ ───────────
-- Um inquérito respondido é um registo de qualidade: é o que se mostra numa
-- auditoria e é a base do plano de melhoria do ano seguinte. Apagá-lo porque
-- o resultado foi mau é a única coisa que este módulo não pode deixar
-- acontecer — e um botão escondido no ecrã não impede ninguém com a consola
-- do browser aberta.
--
-- Um inquérito SEM respostas apaga-se à vontade: é quase sempre um engano de
-- quem o criou duas vezes.
--
-- Restritiva: soma-se com E às outras e não larga nada do que já lá está.
do $$
begin
  drop policy if exists inqueritos_apagar_so_sem_respostas on public.inqueritos;
  create policy inqueritos_apagar_so_sem_respostas on public.inqueritos
    as restrictive for delete using (
      not exists (
        select 1 from public.inqueritos_respostas r where r.inquerito_id = inqueritos.id
      )
    );
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. As políticas certas estão lá e as erradas não:
--      select policyname, cmd, permissive from pg_policies
--       where tablename in ('inqueritos','inqueritos_respostas') order by 1;
--    Não pode aparecer nenhuma com `team_members` na definição:
--      select policyname from pg_policies
--       where tablename like 'inqueritos%'
--         and (qual ilike '%team_members%' or with_check ilike '%team_members%');
--    Tem de dar zero linhas.
--
-- 2. CORRER O sprint153 A SEGUIR (é ele que traz o `qualidade.editar`).
--
-- 3. Na aplicação: /inqueritos → «Novo inquérito» → Famílias → Criar.
--    E depois, no computador:
--      BASE=http://localhost:3311 node scripts/qa-inqueritos.mjs
