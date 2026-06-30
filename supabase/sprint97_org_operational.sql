-- sprint97_org_operational.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RONDA 5 — Estende a partilha por ORGANIZAÇÃO (sprint91) às tabelas OPERACIONAIS
-- que tinham ficado de fora: faturação, agenda, stock, documentos, vendas,
-- atendimentos, escalas de turno e equipa. Sem isto, numa instituição com equipa
-- cada funcionário via só o que ELE registava (e o dono não via nada) — bug que
-- partia a premissa institucional.
--
-- Mesmo padrão de sprint91: adiciona org_id + recorded_by_id + índice, mantém a
-- policy "_own" (user_id) e ADICIONA "_org_access" (org_id ∈ org do utilizador).
-- Retrocompatível: contas sem org continuam por user_id (org_id null). Tolerante:
-- se uma tabela não existir nesta BD, ignora e segue.
-- 2026-06-30.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'billing_entries','appointments','stock_items','documents','sales',
    'encounters','shift_assignments','team_members','hydration_logs'
  ]
  loop
    begin
      execute format(
        'alter table if exists public.%I add column if not exists org_id uuid references public.organizations(id) on delete set null', t);
      execute format(
        'alter table if exists public.%I add column if not exists recorded_by_id uuid references auth.users(id)', t);
      execute format(
        'create index if not exists %I on public.%I (org_id)', t || '_org_idx', t);
    exception when others then
      raise notice 'sprint97: tabela % ignorada (%).', t, sqlerrm;
    end;
  end loop;
end $$;

-- ─── RLS: membros da org veem/editam os registos operacionais da sua org ─────
do $$
declare t text;
begin
  foreach t in array array[
    'billing_entries','appointments','stock_items','documents','sales',
    'encounters','shift_assignments','team_members','hydration_logs'
  ]
  loop
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
    exception
      when others then null;   -- policy já existe / tabela ou coluna em falta → ignora
    end;
  end loop;
end $$;
