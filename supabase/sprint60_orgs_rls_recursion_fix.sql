-- sprint60_orgs_rls_recursion_fix.sql
-- Phlox — Fix: "infinite recursion detected in policy for relation org_members".
--
-- Causa: as policies do sprint49 consultam `org_members` dentro de RLS aplicada
-- à própria `org_members` (e a `organizations` cuja policy faz subquery a
-- `org_members`). Resultado: cada SELECT dispara nova avaliação de policy → loop.
--
-- Fix: as funções helper passam a SECURITY DEFINER (bypassam a RLS de quem
-- chama) e as policies passam a usar essas funções em vez de subqueries
-- inline. As policies de `org_members` deixam de se auto-referenciar.
--
-- 2026-06-03.

-- ─── Helpers SECURITY DEFINER ────────────────────────────────────────────
-- Devolve true se o utilizador pertence (active) à organização.
create or replace function user_in_org(uid uuid, oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from org_members
    where user_id = uid and org_id = oid and active = true
  );
$$;

-- Devolve true se o utilizador é owner/admin da org.
create or replace function user_is_org_admin(uid uuid, oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from org_members
    where user_id = uid and org_id = oid and active = true
      and role in ('owner','admin')
  );
$$;

-- Devolve o array de org_ids onde o utilizador é membro activo.
create or replace function user_org_ids(uid uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(org_id), '{}'::uuid[])
  from org_members
  where user_id = uid and active = true;
$$;

-- Devolve o array de org_ids onde o utilizador é admin/owner.
create or replace function user_admin_org_ids(uid uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(org_id), '{}'::uuid[])
  from org_members
  where user_id = uid and active = true and role in ('owner','admin');
$$;

-- ─── Substitui has_capability por uma versão SECURITY DEFINER ────────────
-- Necessário para que as RLS de muitas tabelas (sprint50+) parem de bater
-- contra a recursão indirecta via org_members.
create or replace function default_capabilities(role text) returns text[]
language plpgsql immutable as $$
begin
  return case role
    when 'owner' then array(select key from capability_catalog)
    when 'admin' then
      array['patients.read','patients.write','patients.delete',
            'episodes.read','episodes.write',
            'prescription.read','prescription.validate',
            'mar.read','rounds.read','rounds.write',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'billing.read','billing.write','billing.fiscal_export','pos.use',
            'team.read','team.manage','team.schedule',
            'quality.read','quality.write','audit.read','org.admin',
            'beds.read','beds.write','triage.read','surgery.read','surgery.write',
            'suppliers.read','suppliers.write','loyalty.read','loyalty.write',
            'bi.use','automation.read','automation.write','agent.use']
    when 'clinician' then
      array['patients.read','patients.write','episodes.read','episodes.write',
            'prescription.read','prescription.write','mar.read','rounds.read','rounds.write',
            'quality.read','team.read',
            'beds.read','beds.write','triage.read','triage.write','surgery.read','surgery.write',
            'bi.use','automation.read','agent.use']
    when 'pharmacist' then
      array['patients.read','prescription.read','prescription.validate',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'rounds.read','rounds.write','billing.read','billing.write','pos.use',
            'quality.read','team.read','beds.read',
            'suppliers.read','suppliers.write','loyalty.read','loyalty.write',
            'bi.use','automation.read','agent.use']
    when 'nurse' then
      array['patients.read','patients.write','episodes.read',
            'prescription.read','mar.read','mar.administer',
            'rounds.read','quality.write','team.read',
            'beds.read','beds.write','triage.read','triage.write','surgery.read','bi.use']
    when 'assistant' then
      array['patients.read','episodes.read','billing.read','billing.write','pos.use','team.read','beds.read','loyalty.read','loyalty.write']
    when 'accountant' then
      array['billing.read','billing.write','billing.fiscal_export','org.billing_settings','suppliers.read','bi.use']
    when 'viewer' then
      array['patients.read','episodes.read','prescription.read','mar.read','rounds.read','stock.read','billing.read','team.read','quality.read','beds.read','triage.read','surgery.read','suppliers.read','loyalty.read','bi.use','automation.read']
    when 'student' then array['patients.read','prescription.read','mar.read','rounds.read','beds.read','triage.read','surgery.read']
    when 'caregiver' then array['patients.read','mar.read','mar.administer']
    when 'self' then array['patients.read']
    else array[]::text[]
  end;
end;
$$;

create or replace function user_capabilities(uid uuid, oid uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select capabilities from org_members where user_id = uid and org_id = oid and active = true limit 1),
    default_capabilities(
      (select role from org_members where user_id = uid and org_id = oid and active = true limit 1)
    )
  );
$$;

create or replace function has_capability(uid uuid, oid uuid, cap text) returns boolean
language sql stable security definer set search_path = public as $$
  select cap = any(user_capabilities(uid, oid));
$$;

-- ─── Reescreve policies de organizations sem recursão ────────────────────
drop policy if exists "orgs_visible_to_members" on organizations;
drop policy if exists "orgs_editable_by_admins" on organizations;
drop policy if exists "orgs_authenticated_create" on organizations;

create policy "orgs_visible_to_members" on organizations for select
  using (id = any(user_org_ids(auth.uid())));

create policy "orgs_editable_by_admins" on organizations for update
  using (id = any(user_admin_org_ids(auth.uid())));

create policy "orgs_authenticated_create" on organizations for insert
  with check (auth.uid() is not null);

-- ─── Reescreve policies de org_members sem auto-referência ───────────────
drop policy if exists "org_members_peers_visible" on org_members;
drop policy if exists "org_members_managed_by_admins" on org_members;

-- (a) O próprio utilizador vê SEMPRE as suas linhas de membership — base case
--     sem recursão.
create policy "org_members_own_rows" on org_members for select
  using (user_id = auth.uid());

-- (b) Membros vêem colegas da mesma org via função SECURITY DEFINER.
create policy "org_members_peers_visible" on org_members for select
  using (org_id = any(user_org_ids(auth.uid())));

-- (c) Admins/owners gerem membros da sua org.
create policy "org_members_managed_by_admins" on org_members for all
  using (org_id = any(user_admin_org_ids(auth.uid())))
  with check (org_id = any(user_admin_org_ids(auth.uid())));

-- ─── Reescreve policies de org_invites também sem subquery recursiva ─────
drop policy if exists "org_invites_admins_only" on org_invites;

create policy "org_invites_admins_only" on org_invites for all
  using (org_id = any(user_admin_org_ids(auth.uid())))
  with check (org_id = any(user_admin_org_ids(auth.uid())));

-- ─── Episodes (sprint51) referenciava org_members — passa pela função ───
do $$ begin
  drop policy if exists "episodes_org_visible" on episodes;
  drop policy if exists "episodes_org_writable" on episodes;

  create policy "episodes_org_visible" on episodes for select
    using (
      org_id is null
      or org_id = any(user_org_ids(auth.uid()))
    );

  create policy "episodes_org_writable" on episodes for all
    using (
      org_id is not null
      and has_capability(auth.uid(), org_id, 'episodes.write')
    )
    with check (
      org_id is not null
      and has_capability(auth.uid(), org_id, 'episodes.write')
    );
exception when undefined_table then null; end $$;

-- Recarregar o cache de schema para que o PostgREST veja tudo de imediato.
notify pgrst, 'reload schema';
