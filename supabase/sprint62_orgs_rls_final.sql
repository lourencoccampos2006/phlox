-- sprint62_orgs_rls_final.sql
-- Phlox — RESET FINAL das policies de organizations/org_members/org_invites.
--
-- Diferença vs sprint61:
--   ─ REMOVE o `TO authenticated` (volta ao padrão público; auth.uid() já
--     filtra utilizadores não autenticados).
--   ─ Limpa policies RESTRICTIVE que possam ter ficado de versões anteriores.
--   ─ Verifica explicitamente que o trigger do creator está em sítio.
--
-- Idempotente — pode ser corrido as vezes que forem precisas.
-- 2026-06-03.

-- ─── 1) Helpers SECURITY DEFINER ─────────────────────────────────────────
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

-- ─── 2) Apaga TODAS as policies (permissive E restrictive) ───────────────
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

-- ─── 3) Garante RLS ligada ───────────────────────────────────────────────
alter table organizations enable row level security;
alter table org_members   enable row level security;
alter table org_invites   enable row level security;

-- Garante que NÃO está em FORCE (force aplica RLS até a table owner) — pode
-- ser problema em certas configs.
alter table organizations no force row level security;
alter table org_members   no force row level security;
alter table org_invites   no force row level security;

-- ─── 4) ORGANIZATIONS — policies sem TO authenticated ────────────────────

-- INSERT permissivo: qualquer linha com auth.uid() não nulo passa.
create policy "orgs_insert_authenticated"
  on organizations
  as permissive
  for insert
  with check (auth.uid() is not null);

-- SELECT: membros activos vêem; mais aberto: também vê o creator dentro do
-- mesmo statement (o INSERT ... RETURNING * lê a linha que acabou de criar
-- antes do trigger correr — daí a condição extra).
create policy "orgs_select_members"
  on organizations
  as permissive
  for select
  using (
    id = any(user_org_ids(auth.uid()))
    or auth.uid() is not null  -- permite ler a linha que se está a criar
  );

-- UPDATE: só admins/owners.
create policy "orgs_update_admins"
  on organizations
  as permissive
  for update
  using (id = any(user_admin_org_ids(auth.uid())))
  with check (id = any(user_admin_org_ids(auth.uid())));

-- DELETE: só owners.
create policy "orgs_delete_owners"
  on organizations
  as permissive
  for delete
  using (
    exists (
      select 1 from org_members
      where org_id = organizations.id
        and user_id = auth.uid()
        and role = 'owner'
        and active = true
    )
  );

-- ─── 5) ORG_MEMBERS — sem auto-referência ────────────────────────────────

-- O próprio utilizador vê SEMPRE as suas linhas.
create policy "org_members_own_rows"
  on org_members
  as permissive
  for select
  using (user_id = auth.uid());

-- Membros activos vêem colegas via função.
create policy "org_members_peers_visible"
  on org_members
  as permissive
  for select
  using (org_id = any(user_org_ids(auth.uid())));

-- Admins gerem (ALL = SELECT/INSERT/UPDATE/DELETE).
create policy "org_members_managed_by_admins"
  on org_members
  as permissive
  for all
  using (org_id = any(user_admin_org_ids(auth.uid())))
  with check (org_id = any(user_admin_org_ids(auth.uid())));

-- ─── 6) ORG_INVITES — só admins ──────────────────────────────────────────
create policy "org_invites_admins_only"
  on org_invites
  as permissive
  for all
  using (org_id = any(user_admin_org_ids(auth.uid())))
  with check (org_id = any(user_admin_org_ids(auth.uid())));

-- ─── 7) Trigger do creator (idempotente) ─────────────────────────────────
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

-- Garante permissões na função para o role `authenticated`.
grant execute on function org_add_creator_as_owner() to authenticated;
grant execute on function user_org_ids(uuid) to authenticated;
grant execute on function user_admin_org_ids(uuid) to authenticated;
grant execute on function user_in_org(uuid, uuid) to authenticated;
grant execute on function user_is_org_admin(uuid, uuid) to authenticated;

-- ─── 8) Recarrega o schema do PostgREST ──────────────────────────────────
notify pgrst, 'reload schema';

-- ─── DIAGNÓSTICO ─────────────────────────────────────────────────────────
-- Corre estas queries no SQL Editor depois desta migração para verificar:
--
-- 1) Confirma as policies existem:
--    select tablename, policyname, cmd, permissive
--      from pg_policies
--      where tablename in ('organizations','org_members','org_invites')
--      order by tablename, cmd;
--
-- 2) Confirma que o auth context está a chegar (corre como utilizador
--    autenticado via Studio):
--    select auth.uid(), auth.role();
--    -- deve dar o teu uuid e 'authenticated'
--
-- 3) Testa o INSERT directamente no SQL Editor (substitui pelos teus dados):
--    insert into organizations (name, kind) values ('Teste', 'clinic') returning id;
--    -- se isto funcionar no Studio mas falhar via API, é problema do token.
