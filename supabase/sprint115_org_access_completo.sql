-- sprint115_org_access_completo.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Achado da auditoria de 2026-07-27/28: `team_members` e `shift_assignments`
-- (entre outras) só tinham a política "_own" (user_id = auth.uid()) — o que
-- significa que CADA pessoa da equipa só conseguia ver a SUA PRÓPRIA linha,
-- nunca a dos colegas. Isto parte por completo a lista "Escalas & Turnos": o
-- dono de um centro de dia nunca via os funcionários que convidou, e cada
-- funcionário via só a si próprio.
--
-- Este ficheiro é 100% IDEMPOTENTE — seguro correr mesmo que algumas destas
-- tabelas já tenham a política (não duplica, não falha, não apaga nada). Corre
-- isto UMA VEZ no SQL Editor do Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'team_members', 'shift_assignments', 'stock_items', 'documents',
    'team_tasks', 'institution_settings', 'compliance_items', 'consents',
    'billing_entries', 'care_plans'
  ]
  loop
    begin
      -- org_id (nullable — contas individuais sem organização continuam a
      -- funcionar por user_id, como sempre funcionaram).
      execute format(
        'alter table if exists public.%I add column if not exists org_id uuid references public.organizations(id) on delete set null', t);
      execute format(
        'create index if not exists %I on public.%I (org_id)', t || '_org_idx', t);
    exception when others then
      raise notice 'sprint115: coluna org_id em % ignorada (%).', t, sqlerrm;
    end;

    begin
      execute format($f$
        create policy "%1$s_org_access" on public.%1$I for all
          using (
            org_id is not null
            and org_id in (select org_id from org_members where user_id = auth.uid() and active = true)
          )
          with check (
            org_id is not null
            and org_id in (select org_id from org_members where user_id = auth.uid() and active = true)
          )
      $f$, t);
    exception when others then
      null; -- política já existe (duplicate_object) ou tabela/coluna em falta nesta BD — ignora
    end;
  end loop;
end $$;
