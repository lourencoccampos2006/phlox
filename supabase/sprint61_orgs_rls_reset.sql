-- sprint61_orgs_rls_reset.sql
-- Phlox — RESET completo das policies de organizations/org_members/org_invites.
--
-- Corre isto se receberes:
--   ─ "new row violates row-level security policy for table organizations"
--   ─ "infinite recursion detected in policy for relation org_members"
--
-- O ficheiro é idempotente: pode ser re-executado as vezes que forem precisas.
-- Não toca em dados, só em funções e policies.
-- 2026-06-03.

-- ─── 1) Helpers SECURITY DEFINER (quebram a recursão) ────────────────────
create or replace function user_org_ids(uid uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(org_id), '{}'::uuid[])
  from org_members
  where user_id = uid and active = true;
$$;

create or replace function user_admin_org_ids(uid uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(org_id), '{}'::uuid[])
  from org_members
  where user_id = uid and active = true and role in ('owner','admin');
$$;

create or replace function user_in_org(uid uuid, oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from org_members
    where user_id = uid and org_id = oid and active = true
  );
$$;

create or replace function user_is_org_admin(uid uuid, oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from org_members
    where user_id = uid and org_id = oid and active = true
      and role in ('owner','admin')
  );
$$;

-- ─── 2) Apaga TODAS as policies antigas destas tabelas ───────────────────
-- Usa pg_policies para ser robusto a nomes que tenham mudado.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where tablename in ('organizations','org_members','org_invites')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ─── 3) Garante que RLS está ligada (idempotente) ────────────────────────
alter table organizations enable row level security;
alter table org_members   enable row level security;
alter table org_invites   enable row level security;

-- ─── 4) ORGANIZATIONS — 3 policies, SEM subqueries auto-referenciais ─────

-- (a) Qualquer utilizador autenticado pode CRIAR organizações.
--     O trigger SQL `org_creator_owner` adiciona-o automaticamente como owner.
create policy "orgs_authenticated_create"
  on organizations for insert
  to authenticated
  with check (auth.uid() is not null);

-- (b) Membros vêem as orgs em que são membros activos.
create policy "orgs_visible_to_members"
  on organizations for select
  to authenticated
  using (id = any(user_org_ids(auth.uid())));

-- (c) Admins/owners editam a sua org.
create policy "orgs_editable_by_admins"
  on organizations for update
  to authenticated
  using (id = any(user_admin_org_ids(auth.uid())))
  with check (id = any(user_admin_org_ids(auth.uid())));

-- ─── 5) ORG_MEMBERS — base case sem recursão ─────────────────────────────

-- (a) O utilizador vê SEMPRE as suas linhas — não recursa, é só user_id.
create policy "org_members_own_rows"
  on org_members for select
  to authenticated
  using (user_id = auth.uid());

-- (b) Membros activos vêem colegas via função SECURITY DEFINER (sem recursão).
create policy "org_members_peers_visible"
  on org_members for select
  to authenticated
  using (org_id = any(user_org_ids(auth.uid())));

-- (c) Admins gerem membros. O trigger insere o creator sem RLS (SECURITY DEFINER).
create policy "org_members_managed_by_admins"
  on org_members for all
  to authenticated
  using (org_id = any(user_admin_org_ids(auth.uid())))
  with check (org_id = any(user_admin_org_ids(auth.uid())));

-- ─── 6) ORG_INVITES — apenas admins da org ───────────────────────────────
create policy "org_invites_admins_only"
  on org_invites for all
  to authenticated
  using (org_id = any(user_admin_org_ids(auth.uid())))
  with check (org_id = any(user_admin_org_ids(auth.uid())));

-- ─── 7) Garante o trigger que adiciona o creator como owner ──────────────
-- (Replica o do sprint49 para o caso de a função se ter perdido.)
create or replace function org_add_creator_as_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into org_members (org_id, user_id, role)
  values (new.id, auth.uid(), 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists org_creator_owner on organizations;
create trigger org_creator_owner after insert on organizations
  for each row execute procedure org_add_creator_as_owner();

-- ─── 8) Faz o PostgREST reler o schema imediatamente ─────────────────────
notify pgrst, 'reload schema';

-- ─── Sanity check (opcional, lê e mostra) ────────────────────────────────
-- Devias ver 3 policies em organizations e 3 em org_members.
-- select tablename, policyname, cmd from pg_policies
--   where tablename in ('organizations','org_members','org_invites')
--   order by tablename, policyname;
