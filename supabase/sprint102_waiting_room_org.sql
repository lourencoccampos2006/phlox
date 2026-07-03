-- sprint102_waiting_room_org.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda 11 — /sala-espera (fila de atendimento) passou a ser partilhada pela
-- organização (antes usava eq('user_id') → a equipa via filas diferentes). A
-- tabela waiting_room ficou de fora do sprint97; acrescentamos org_id +
-- recorded_by_id + policy de org, no mesmo padrão das restantes operacionais.
-- Retrocompatível: contas sem org continuam por user_id (org_id null).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  begin
    alter table if exists waiting_room add column if not exists org_id uuid references organizations(id) on delete set null;
    alter table if exists waiting_room add column if not exists recorded_by_id uuid references auth.users(id);
    create index if not exists waiting_room_org_idx on waiting_room (org_id);
  exception when others then raise notice 'sprint102: waiting_room cols ignoradas (%).', sqlerrm;
  end;
  -- policy de leitura/escrita pela org (a par da _own por user_id que já exista)
  begin
    execute $p$create policy "waiting_room_org_access" on waiting_room for all
      using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
      with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))$p$;
  exception when others then null; end;
  -- restrição de escrita para viewer (só leitura), como sprint101
  begin
    execute $p$create policy "waiting_room_ins_noviewer" on waiting_room as restrictive for insert
      with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
  exception when others then null; end;
  begin
    execute $p$create policy "waiting_room_upd_noviewer" on waiting_room as restrictive for update
      using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
      with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
  exception when others then null; end;
  begin
    execute $p$create policy "waiting_room_del_noviewer" on waiting_room as restrictive for delete
      using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
  exception when others then null; end;
end $$;
