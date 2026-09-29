-- supabase/sprint168_fechar_perfis.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto ASSIM QUE PUDERES, antes das outras que estão à espera.
-- É curto e não depende de nenhuma delas.
--
-- ── O QUE ESTÁ A ACONTECER AGORA, NA BASE DE DADOS A SÉRIO ─────────────────
-- Com a chave pública do site — a que está no JavaScript de qualquer página,
-- e que qualquer pessoa lê em dois cliques — isto responde:
--
--     GET /rest/v1/profiles?select=*
--
-- E devolve TRÊS perfis inteiros. Não só o nome: o email, o NIF, o número de
-- utente de saúde, o identificador de cliente do Stripe, o plano, a
-- organização. Medido hoje, 2026-09-28, com a chave pública deste projeto.
--
-- ── PORQUE É QUE O sprint150 NÃO CHEGOU ────────────────────────────────────
-- Chegou, para tudo o resto. Confirmei tabela a tabela: `personal_meds`,
-- `organizations`, `phlox_links`, `emergency_tokens`, `clinical_consults`,
-- `grand_round_cases` e `arena_attempts` respondem todas 401 a quem não tem
-- sessão. Só `profiles` continua a responder 200.
--
-- A linha `revoke select on profiles from anon` existe no ficheiro do
-- sprint150, na secção 4, com a nota «DECIDIDO (2026-09-24)» — foi
-- acrescentada DEPOIS de tu teres corrido o ficheiro. Por isso nunca correu.
--
-- ── E COM SESSÃO? ───────────────────────────────────────────────────────────
-- Também está mal, embora menos: entrei com a conta de QA — uma conta comum —
-- e li o email dos três perfis com `connect_visible`. Hoje o NIF deles está
-- vazio, por isso não saiu nada de grave; no dia em que alguém o preencher,
-- sai.
--
-- A causa é a mesma que já está apontada na memória de 2026-07-28: a RLS do
-- Postgres é por LINHA e não por COLUNA. Uma política que deixa ver o perfil
-- de alguém deixa ver o perfil TODO.
--
-- ── A CORREÇÃO, EM TRÊS PARTES ──────────────────────────────────────────────
-- 1. Fechar a `profiles` a quem não tem sessão.
-- 2. Uma VISTA com apenas as colunas que podem ser vistas por outros, para o
--    que precisa mesmo delas: o nome de um colega da mesma casa, e o
--    directório profissional.
-- 3. Uma política RESTRITIVA que faz a tabela só devolver a própria linha,
--    seja qual for a política permissiva que exista por baixo.
--
-- A número 3 é restritiva de propósito: as restritivas somam-se com E às que
-- já existem, por isso não preciso de saber os nomes das políticas antigas
-- (algumas foram criadas no painel do Supabase e não estão em ficheiro
-- nenhum). Fecha por cima de tudo o que lá esteja.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. FECHAR A QUEM NÃO TEM SESSÃO
-- ═══════════════════════════════════════════════════════════════════════════
revoke select on profiles from anon;
revoke all on profiles from anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. O QUE OS OUTROS PODEM VER
-- ═══════════════════════════════════════════════════════════════════════════
-- Nove colunas. Nem email, nem NIF, nem número de utente, nem nada do Stripe,
-- nem as preferências, nem o plano.
--
-- Quem aparece aqui:
--   • a própria pessoa;
--   • quem partilha uma casa com ela (é preciso para mostrar «registado por
--     Ana Silva» sem ir buscar o perfil inteiro da Ana);
--   • quem se pôs no directório profissional (`connect_visible`), que é uma
--     escolha explícita de quem lá está.
--
-- `connect_visible` vai junto, e é de propósito: é o interruptor que a própria
-- pessoa ligou para aparecer no directório, e sem ele o directório não se
-- consegue filtrar (a vista também inclui a própria pessoa e os colegas de
-- casa, que não são do directório). Não é informação sensível — é uma escolha
-- que a pessoa fez para ser encontrada.
create or replace view perfis_visiveis as
  select p.id, p.name, p.display_name, p.avatar, p.connect_visible,
         p.connect_handle, p.professional_role, p.institution, p.speciality
    from profiles p
   where p.id = (select auth.uid())
      or p.connect_visible = true
      or exists (
        select 1
          from org_members meu
          join org_members dele on dele.org_id = meu.org_id and dele.active
         where meu.user_id = (select auth.uid()) and meu.active
           and dele.user_id = p.id
      );

-- `security_invoker = false` de propósito, e escrito à mão para ninguém ter de
-- adivinhar: a vista TEM de passar por cima da RLS da `profiles`, senão a
-- política restritiva da secção 3 fazia-a devolver só a própria linha e ela
-- deixava de servir para nada.
--
-- É seguro porque o que a vista mostra são as nove colunas de cima e mais
-- nenhuma, e porque o `where` já diz a quem. A memória avisa que «vistas sem
-- security_invoker ignoram a RLS» — é esse o ponto aqui, e é por isso que a
-- lista de colunas é curta e explícita em vez de um `select *`.
alter view perfis_visiveis set (security_invoker = false);

grant select on perfis_visiveis to authenticated;
revoke all on perfis_visiveis from anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. A TABELA SÓ DEVOLVE A PRÓPRIA LINHA
-- ═══════════════════════════════════════════════════════════════════════════
-- RESTRITIVA: soma-se com E a tudo o que já exista, sem precisar de saber os
-- nomes das políticas antigas nem de as apagar. Se uma delas dizia «podes ver
-- quem tem connect_visible», passa a dizer «podes ver quem tem connect_visible
-- E é a tua própria linha» — ou seja, só a tua.
--
-- O directório e os nomes dos colegas passam a vir da vista de cima.
do $$ begin
  drop policy if exists "profiles_so_a_propria_linha" on profiles;
  create policy "profiles_so_a_propria_linha" on profiles
    as restrictive for select
    using (id = (select auth.uid()));
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR — corre isto a seguir, aqui mesmo
-- ═══════════════════════════════════════════════════════════════════════════
-- Nenhuma linha (o `anon` deixou de poder ler):
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name = 'profiles' and grantee = 'anon';
--
-- A vista existe e não mostra o email:
-- select column_name from information_schema.columns
--  where table_name = 'perfis_visiveis' order by column_name;
--   -- avatar, connect_handle, connect_visible, display_name, id, institution,
--   -- name, professional_role, speciality   (nove, e nenhuma é o email)
--
-- E no terminal:
--   node scripts/check-leitura-anonima.mjs     → nenhuma tabela aberta
--   node scripts/check-perfis.mjs              → o email não sai
