-- sprint110_viewer_bypass_fix.sql
-- Auditoria de segurança 2026-07-13: o padrão que impede o papel "viewer" (só
-- leitura) de escrever (sprint101_readonly_and_team_link.sql) só cobria 16
-- tabelas — todas as tabelas partilhadas por organização criadas DEPOIS do
-- sprint101 (e duas do próprio sprint101, safety_events/pharma_interventions,
-- que ganharam org_id nesse ficheiro mas ficaram fora do array de enforcement
-- por descuido) nunca receberam a mesma proteção. Um utilizador com o cargo
-- "viewer" numa instituição conseguia escrever/apagar diretamente nestas
-- tabelas via Supabase client, incluindo lançamentos financeiros
-- (finance_entries) — o bloqueio no cliente (scope.canEdit) é só cosmético
-- sem isto no servidor. Mesmo padrão exato do sprint101, mesma tabela de
-- "não-viewer", só a estender a mais 9 tabelas.

do $$
declare t text;
declare notviewer text := $q$(
  org_id is null
  or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer')
)$q$;
begin
  foreach t in array array[
    'finance_entries','prescription_queue','safety_events','pharma_interventions',
    'attendance','patient_vigilance','team_messages','stock_consumption',
    'rounds','round_assignments','recurring_activities'
  ]
  loop
    begin
      execute format('create policy "%1$s_ins_noviewer" on public.%1$I as restrictive for insert with check %2$s', t, notviewer);
    exception when others then raise notice 'sprint110 ins % (%)', t, sqlerrm; end;
    begin
      execute format('create policy "%1$s_upd_noviewer" on public.%1$I as restrictive for update using %2$s with check %2$s', t, notviewer);
    exception when others then raise notice 'sprint110 upd % (%)', t, sqlerrm; end;
    begin
      execute format('create policy "%1$s_del_noviewer" on public.%1$I as restrictive for delete using %2$s', t, notviewer);
    exception when others then raise notice 'sprint110 del % (%)', t, sqlerrm; end;
  end loop;
end $$;
