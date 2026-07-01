-- sprint101_readonly_and_team_link.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda 10 — auditoria institucional. Dois reforços de servidor:
--
--  (A) team_members.user_id — liga a linha de escala (team_members) à conta real
--      (org_members / profiles). Assim "adicionar funcionário em /equipa" cria
--      logo uma pessoa AGENDÁVEL em /schedule (antes eram sistemas separados).
--
--  (B) RLS que impede o papel "viewer" (Só leitura) de escrever nas tabelas
--      operacionais. Até agora o "viewer" era só cosmético (bloqueado no cliente
--      mas não no servidor). Agora é a sério.
-- ─────────────────────────────────────────────────────────────────────────────

-- (A) Ligação escala ↔ conta ───────────────────────────────────────────────────
alter table if exists team_members add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists team_members_user_idx on team_members (user_id);

-- (A2) /quality: a tabela safety_events (sprint10) não tinha patient_name (o
-- formulário enviava-o → INSERT dava 400, "registar evento não funcionava") nem
-- org_id/recorded_by_id (era pessoal, não partilhada pela equipa). Acrescentamos.
alter table if exists safety_events add column if not exists patient_name text;
alter table if exists safety_events add column if not exists org_id uuid references organizations(id) on delete set null;
alter table if exists safety_events add column if not exists recorded_by_id uuid references auth.users(id);
create index if not exists safety_events_org_idx on safety_events (org_id);
alter table if exists pharma_interventions add column if not exists org_id uuid references organizations(id) on delete set null;
alter table if exists pharma_interventions add column if not exists recorded_by_id uuid references auth.users(id);
create index if not exists pharma_interventions_org_idx on pharma_interventions (org_id);
-- policies org (ler/escrever pela org, como as outras tabelas partilhadas)
do $$
begin
  begin execute $p$create policy "safety_events_org_access" on safety_events for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))$p$;
  exception when others then null; end;
  begin execute $p$create policy "pharma_interventions_org_access" on pharma_interventions for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))$p$;
  exception when others then null; end;
end $$;

-- (B) Enforcement do papel "viewer" (só leitura) ───────────────────────────────
-- Um "não-viewer" da org é quem pertence ativo e tem papel != viewer.
-- Usamos policies RESTRITIVAS separadas por comando de ESCRITA (INSERT/UPDATE/
-- DELETE) — NÃO tocamos no SELECT, por isso o viewer continua a LER normalmente.
-- Restritiva = tem de ser satisfeita SEMPRE (AND com as permissivas existentes).
-- Contas individuais (org_id null) não são afetadas.
do $$
declare t text;
declare notviewer text := $q$(
  org_id is null
  or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer')
)$q$;
begin
  foreach t in array array[
    'care_records','mar_records','incidents','assessments','activities',
    'activity_participations','wounds','vitals','patient_meds','patients',
    'family_messages','visit_requests','resident_contacts','resident_requests',
    'team_members','shift_assignments'
  ]
  loop
    -- INSERT: valida a linha nova (with check)
    begin
      execute format('create policy "%1$s_ins_noviewer" on public.%1$I as restrictive for insert with check %2$s', t, notviewer);
    exception when others then raise notice 'sprint101 ins % (%)', t, sqlerrm; end;
    -- UPDATE: valida a linha existente (using) e a nova (with check)
    begin
      execute format('create policy "%1$s_upd_noviewer" on public.%1$I as restrictive for update using %2$s with check %2$s', t, notviewer);
    exception when others then raise notice 'sprint101 upd % (%)', t, sqlerrm; end;
    -- DELETE: valida a linha a apagar (using)
    begin
      execute format('create policy "%1$s_del_noviewer" on public.%1$I as restrictive for delete using %2$s', t, notviewer);
    exception when others then raise notice 'sprint101 del % (%)', t, sqlerrm; end;
  end loop;
end $$;
