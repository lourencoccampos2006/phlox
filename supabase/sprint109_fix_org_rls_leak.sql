-- sprint109_fix_org_rls_leak.sql
-- Corrige uma fuga de dados entre instituições: a policy "orgs_select_members"
-- (sprint65) tinha uma cláusula "or auth.uid() is not null" que anula por
-- completo a verificação de pertença — qualquer utilizador autenticado
-- conseguia ler os dados de QUALQUER organização (nome, NIF, morada,
-- telefone, mensalidade, capacidade), não só as suas. Encontrado em auditoria
-- de segurança 2026-07-13; confirmado em uso direto por
-- app/api/orgs/[id]/route.ts (GET não faz nenhuma verificação própria, conta
-- inteiramente com a RLS). A leitura pública de organizações com public=true
-- (sprint93_org_public.sql, "orgs_public_read") continua a funcionar — é uma
-- policy separada, correta, e não é afetada por esta correção.

drop policy if exists "orgs_select_members" on organizations;

create policy "orgs_select_members"
  on organizations as permissive for select
  using (
    id = any(user_org_ids(auth.uid()))
  );
