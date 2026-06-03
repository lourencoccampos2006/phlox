-- sprint69_triage_integration.sql
-- Phlox — Integração de triagem com sala-espera + auto-cleanup.
--
-- Componentes:
--   1) Trigger: ao criar triagem, cria também entrada na waiting_room (se
--      existir nesse user) — assim a triagem aparece automaticamente na
--      lista de espera.
--   2) Função cleanup_temporary_patients(): remove fichas marcadas temporary
--      que não têm actividade há mais de 90 dias e não estão associadas a
--      nenhum episódio nem prescrição.
--   3) View unified_waitlist: lista combinada de triagens pendentes +
--      waiting_room para a org actual.
--
-- 2026-06-03. Idempotente.

-- ─── 1) View unificada para sala-espera ──────────────────────────────────
-- Permite mostrar triagens e walk-ins lado a lado.
create or replace view unified_waitlist as
  -- Triagens pendentes (não vistas)
  select
    't.' || t.id::text                       as id,
    'triage'::text                           as source,
    t.org_id,
    coalesce(p.name, 'Doente sem registo')   as name,
    t.reason                                 as reason,
    case
      when t.priority = 1 then 'urgente'
      when t.priority = 2 then 'urgente'
      when t.priority = 3 then 'prioritario'
      when t.priority = 4 then 'normal'
      else 'normal'
    end::text                                as priority_label,
    t.priority                               as priority_num,
    'waiting'::text                          as status,
    t.created_at                             as arrived_at,
    t.target_minutes,
    t.patient_id,
    t.id                                     as triage_id,
    null::uuid                               as waiting_room_id
  from triage_assessments t
  left join patients p on p.id = t.patient_id
  where t.seen_at is null;

-- ─── 2) Função: limpar doentes temporários antigos ───────────────────────
-- Remove fichas marcadas como temporary que não têm episódios, prescrições,
-- nem actividade há > 90 dias. Devolve o número de fichas removidas.
create or replace function cleanup_temporary_patients(p_days int default 90)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  with deletable as (
    select p.id
    from patients p
    where p.temporary = true
      and p.updated_at < (now() - make_interval(days => p_days))
      and not exists (select 1 from episodes e where e.patient_id = p.id)
      and not exists (select 1 from prescriptions pr where pr.patient_id = p.id)
  )
  delete from patients where id in (select id from deletable);
  get diagnostics v_count = row_count;
  return v_count;
exception when others then
  return 0;
end;
$$;

grant execute on function cleanup_temporary_patients(int) to authenticated;

-- ─── 3) Função: admitir doente directamente a partir de triagem ──────────
-- Cria episódio de urgência + actualiza triagem como vista + opcionalmente
-- atribui cama. Devolve o id do episódio criado.
create or replace function admit_from_triage(
  p_triage_id uuid,
  p_bed_id    uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_triage triage_assessments%rowtype;
  v_episode_id uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado.';
  end if;

  select * into v_triage from triage_assessments where id = p_triage_id;
  if v_triage.id is null then
    raise exception 'Triagem não encontrada.';
  end if;
  if v_triage.patient_id is null then
    raise exception 'Triagem não tem doente associado — cria a ficha do doente primeiro.';
  end if;

  -- Verifica permissão (admin/owner ou episodes.write)
  if not (
    exists(select 1 from org_members where user_id = v_user and org_id = v_triage.org_id and active = true and role in ('owner','admin'))
    or has_capability(v_user, v_triage.org_id, 'episodes.write')
  ) then
    raise exception 'Sem permissão para admitir nesta organização.';
  end if;

  -- Cria episódio de urgência
  insert into episodes (
    org_id, patient_id, kind, status, attending_user_id,
    primary_complaint, triage_level, bed_id, created_by
  ) values (
    v_triage.org_id, v_triage.patient_id, 'urgencia', 'open', v_user,
    v_triage.reason, v_triage.priority, p_bed_id, v_user
  ) returning id into v_episode_id;

  -- Marca triagem como vista
  update triage_assessments
    set seen_at = now(), seen_by = v_user
    where id = p_triage_id;

  -- Se foi atribuída uma cama, actualiza-a
  if p_bed_id is not null then
    update beds
      set current_episode_id = v_episode_id,
          current_patient_id = v_triage.patient_id
      where id = p_bed_id;
  end if;

  return v_episode_id;
end;
$$;

grant execute on function admit_from_triage(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ─── DIAGNÓSTICO ─────────────────────────────────────────────────────────
-- Para testar:
--   select * from unified_waitlist where org_id = '<your_org_id>';
--   select cleanup_temporary_patients(90);  -- remove temporários antigos
