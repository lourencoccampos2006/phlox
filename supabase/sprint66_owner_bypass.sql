-- sprint66_owner_bypass.sql
-- Phlox — Owner/admin têm acesso total, mesmo sem capability_catalog povoado.
--
-- Por que: se os sprints 50/56/57/59/64 não foram corridos, o
-- capability_catalog está vazio. Como `default_capabilities('owner')` faz
-- `array(select key from capability_catalog)`, devolve um array vazio.
-- Resultado: o owner não tem capabilities → has_capability() rejeita tudo
-- → o UI mostra "Sem permissão" em todas as ferramentas.
--
-- Fix: has_capability() devolve TRUE incondicionalmente para owner/admin
-- (semântica natural do role). Funciona independentemente do estado do
-- catálogo.
--
-- 2026-06-03. Idempotente.

create or replace function has_capability(uid uuid, oid uuid, cap text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    -- Owner/admin têm sempre tudo
    exists(
      select 1 from org_members
      where user_id = uid and org_id = oid
        and active = true
        and role in ('owner','admin')
    )
    -- Caso contrário verifica a capability explícita
    or cap = any(
      coalesce(
        (select capabilities from org_members
         where user_id = uid and org_id = oid and active = true limit 1),
        default_capabilities(
          (select role from org_members
           where user_id = uid and org_id = oid and active = true limit 1)
        )
      )
    );
$$;

grant execute on function has_capability(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
