-- sprint118_shift_coverage.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Cobertura de turnos ("alguém não pode vir, quem cobre?"). A tabela
-- shift_vacancies já existia desde o sprint10 (era pensada para um mercado
-- genérico de turnos hospitalares) mas ficou parada: nunca teve org_id/
-- recorded_by_id (só policy "vacancies_own" por user_id), por isso numa
-- organização a equipa NUNCA via as vagas dos colegas — o oposto do que uma
-- vaga de turno precisa (alguém diferente de quem a abriu tem de a ver e
-- reivindicar). Também não tinha nenhum estado de fluxo (aberta/coberta/
-- cancelada) nem ligação a quem cobre. Sem UI em lado nenhum do produto.
--
-- Isto tornou-se o gap real escolhido para esta ronda: um lar/centro de dia
-- 24h tem faltas de última hora com frequência (baixa médica, imprevisto) e
-- hoje o /equipa (Escalas) só mostra "Lacunas" como contagem — não há forma
-- de publicar a vaga nem de um colega a reivindicar. Aqui fechamos o ciclo:
-- org-scoping igual ao resto da plataforma (sprint102/109 pattern) + colunas
-- de fluxo mínimas para um quadro de cobertura funcional.
--
-- Idempotente e retrocompatível: conta individual (sem org) continua a
-- funcionar por user_id, como até agora.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  -- Org-scoping (mesmo padrão de sprint102_waiting_room_org.sql)
  begin
    alter table if exists shift_vacancies add column if not exists org_id uuid references organizations(id) on delete set null;
    alter table if exists shift_vacancies add column if not exists recorded_by_id uuid references auth.users(id);
    create index if not exists shift_vacancies_org_idx on shift_vacancies (org_id);
  exception when others then raise notice 'sprint118: shift_vacancies org cols ignoradas (%).', sqlerrm;
  end;

  -- Fluxo de cobertura: liga-se ao turno/membro em falta, guarda quem cobre.
  begin
    alter table if exists shift_vacancies add column if not exists team_member_id uuid references team_members(id) on delete set null;
    alter table if exists shift_vacancies add column if not exists shift_assignment_id uuid references shift_assignments(id) on delete set null;
    alter table if exists shift_vacancies add column if not exists status text not null default 'open';
    alter table if exists shift_vacancies add column if not exists reason text;
    alter table if exists shift_vacancies add column if not exists claimed_by_id uuid references team_members(id) on delete set null;
    alter table if exists shift_vacancies add column if not exists claimed_by_name text;
    alter table if exists shift_vacancies add column if not exists claimed_at timestamptz;
    alter table if exists shift_vacancies add column if not exists notes text;
  exception when others then raise notice 'sprint118: shift_vacancies flow cols ignoradas (%).', sqlerrm;
  end;

  begin
    alter table shift_vacancies add constraint shift_vacancies_status_check check (status in ('open', 'filled', 'cancelled'));
  exception when duplicate_object then null; when others then null; end;

  create index if not exists shift_vacancies_status_idx on shift_vacancies (status);

  -- Policies de organização (a par da "vacancies_own" já existente por user_id).
  begin
    execute $p$create policy "shift_vacancies_org_access" on shift_vacancies for all
      using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
      with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))$p$;
  exception when others then null; end;
  begin
    execute $p$create policy "shift_vacancies_ins_noviewer" on shift_vacancies as restrictive for insert
      with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
  exception when others then null; end;
  begin
    execute $p$create policy "shift_vacancies_upd_noviewer" on shift_vacancies as restrictive for update
      using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
      with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
  exception when others then null; end;
  begin
    execute $p$create policy "shift_vacancies_del_noviewer" on shift_vacancies as restrictive for delete
      using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
  exception when others then null; end;
end $$;
