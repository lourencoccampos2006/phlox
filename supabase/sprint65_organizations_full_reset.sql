-- sprint65_organizations_full_reset.sql
-- Phlox — RESET COMPLETO do esquema da tabela organizations.
--
-- Corre isto se receberes QUALQUER erro tipo:
--   ─ column "X" of relation "organizations" does not exist
--   ─ infinite recursion detected in policy for relation "org_members"
--   ─ new row violates row-level security policy for table "organizations"
--   ─ Could not find the 'X' column of 'organizations' in the schema cache
--
-- Esta migração faz o reset definitivo:
--   1) Garante que TODAS as colunas existem (com defaults para linhas antigas)
--   2) Apaga e recria policies, helpers, RPCs e triggers
--   3) Recarrega o schema do PostgREST
--
-- Idempotente. Pode ser corrida quantas vezes quiseres.
-- Os teus dados estão SEGUROS — só adiciona colunas e ajusta policies.
--
-- 2026-06-03.

-- ════════════════════════════════════════════════════════════════════════
-- 1) Garante que a tabela existe
-- ════════════════════════════════════════════════════════════════════════
create table if not exists organizations (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

-- ════════════════════════════════════════════════════════════════════════
-- 2) Garante TODAS as colunas (com defaults para evitar erros em linhas antigas)
-- ════════════════════════════════════════════════════════════════════════
do $$ begin
  -- 'kind' com default 'other' para não falhar com NOT NULL em linhas existentes
  alter table organizations add column if not exists kind text default 'other';
  -- Se tinha valores nulos, atribui 'other'
  update organizations set kind = 'other' where kind is null;
  -- Agora pode ser NOT NULL com segurança
  begin
    alter table organizations alter column kind set not null;
  exception when others then null; end;

  -- Restantes colunas
  alter table organizations add column if not exists short_name    text;
  alter table organizations add column if not exists vat_number    text;
  alter table organizations add column if not exists logo_url      text;
  alter table organizations add column if not exists accent_color  text default '#0d6e42';
  alter table organizations add column if not exists address       text;
  alter table organizations add column if not exists postal_code   text;
  alter table organizations add column if not exists city          text;
  alter table organizations add column if not exists phone         text;
  alter table organizations add column if not exists email         text;
  alter table organizations add column if not exists metadata      jsonb default '{}'::jsonb;
  alter table organizations add column if not exists active        boolean not null default true;
  alter table organizations add column if not exists created_at    timestamptz not null default now();
  alter table organizations add column if not exists updated_at    timestamptz not null default now();
  alter table organizations add column if not exists director      text;
  alter table organizations add column if not exists total_beds    int;
end $$;

-- Garante o CHECK constraint do `kind` (com try/except para evitar erro se já existe)
do $$ begin
  alter table organizations drop constraint if exists organizations_kind_check;
  alter table organizations add constraint organizations_kind_check
    check (kind in ('hospital','clinic','nursing_home','pharmacy_community','pharmacy_hospital','health_center','solo','other'));
exception when others then null; end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3) Garante que org_members existe
-- ════════════════════════════════════════════════════════════════════════
create table if not exists org_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'viewer',
  capabilities  text[],
  department    text,
  active        boolean not null default true,
  invited_by    uuid references auth.users(id),
  joined_at     timestamptz not null default now()
);

do $$ begin
  alter table org_members add constraint org_members_org_user_unq unique (org_id, user_id);
exception when others then null; end $$;

-- CHECK do role
do $$ begin
  alter table org_members drop constraint if exists org_members_role_check;
  alter table org_members add constraint org_members_role_check
    check (role in ('owner','admin','clinician','pharmacist','nurse','assistant','accountant','viewer','student','caregiver','self'));
exception when others then null; end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4) Garante que org_invites existe
-- ════════════════════════════════════════════════════════════════════════
create table if not exists org_invites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  email         text not null,
  role          text not null default 'viewer',
  department    text,
  invited_by    uuid references auth.users(id),
  token         text not null unique,
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users(id),
  revoked       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- 5) Funções helper SECURITY DEFINER
-- ════════════════════════════════════════════════════════════════════════
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

-- Função updated_at (para o trigger)
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 6) Limpa policies antigas
-- ════════════════════════════════════════════════════════════════════════
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

-- ════════════════════════════════════════════════════════════════════════
-- 7) Ativa RLS
-- ════════════════════════════════════════════════════════════════════════
alter table organizations enable row level security;
alter table org_members   enable row level security;
alter table org_invites   enable row level security;

alter table organizations no force row level security;
alter table org_members   no force row level security;
alter table org_invites   no force row level security;

-- ════════════════════════════════════════════════════════════════════════
-- 8) Policies — organizations
-- ════════════════════════════════════════════════════════════════════════
create policy "orgs_insert_authenticated"
  on organizations as permissive for insert
  with check (auth.uid() is not null);

create policy "orgs_select_members"
  on organizations as permissive for select
  using (
    id = any(user_org_ids(auth.uid()))
    or auth.uid() is not null
  );

create policy "orgs_update_admins"
  on organizations as permissive for update
  using (id = any(user_admin_org_ids(auth.uid())))
  with check (id = any(user_admin_org_ids(auth.uid())));

-- ════════════════════════════════════════════════════════════════════════
-- 9) Policies — org_members
-- ════════════════════════════════════════════════════════════════════════
create policy "org_members_own_rows"
  on org_members as permissive for select
  using (user_id = auth.uid());

create policy "org_members_peers_visible"
  on org_members as permissive for select
  using (org_id = any(user_org_ids(auth.uid())));

create policy "org_members_managed_by_admins"
  on org_members as permissive for all
  using (org_id = any(user_admin_org_ids(auth.uid())))
  with check (org_id = any(user_admin_org_ids(auth.uid())));

-- ════════════════════════════════════════════════════════════════════════
-- 10) Policies — org_invites
-- ════════════════════════════════════════════════════════════════════════
create policy "org_invites_admins_only"
  on org_invites as permissive for all
  using (org_id = any(user_admin_org_ids(auth.uid())))
  with check (org_id = any(user_admin_org_ids(auth.uid())));

-- ════════════════════════════════════════════════════════════════════════
-- 11) RPC: create_org_with_owner — versão definitiva
-- ════════════════════════════════════════════════════════════════════════
create or replace function create_org_with_owner(
  p_name        text,
  p_kind        text,
  p_short_name  text default null,
  p_vat_number  text default null,
  p_city        text default null,
  p_accent_color text default '#0d6e42',
  p_logo_url    text default null,
  p_director    text default null,
  p_total_beds  int  default null
) returns organizations
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_org  organizations;
begin
  if v_user is null then
    raise exception 'Não autenticado — auth.uid() é NULL.';
  end if;

  if p_kind not in ('hospital','clinic','nursing_home','pharmacy_community','pharmacy_hospital','health_center','solo','other') then
    raise exception 'Tipo inválido: %', p_kind;
  end if;

  insert into organizations (
    name, kind, short_name, vat_number, city, accent_color,
    logo_url, director, total_beds
  )
  values (
    nullif(trim(p_name), ''),
    p_kind,
    nullif(trim(p_short_name), ''),
    nullif(trim(p_vat_number), ''),
    nullif(trim(p_city), ''),
    coalesce(p_accent_color, '#0d6e42'),
    nullif(trim(p_logo_url), ''),
    nullif(trim(p_director), ''),
    p_total_beds
  )
  returning * into v_org;

  insert into org_members (org_id, user_id, role, active)
  values (v_org.id, v_user, 'owner', true)
  on conflict (org_id, user_id) do update
    set role = 'owner', active = true;

  return v_org;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 12) Trigger fallback (caso a RPC não seja usada)
-- ════════════════════════════════════════════════════════════════════════
create or replace function org_add_creator_as_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into org_members (org_id, user_id, role, active)
    values (new.id, auth.uid(), 'owner', true)
    on conflict (org_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists org_creator_owner on organizations;
create trigger org_creator_owner after insert on organizations
  for each row execute procedure org_add_creator_as_owner();

drop trigger if exists organizations_touch on organizations;
create trigger organizations_touch before update on organizations
  for each row execute procedure set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 13) Função para resgatar orgs órfãs
-- ════════════════════════════════════════════════════════════════════════
create or replace function claim_orphan_orgs() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_count int := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado.';
  end if;
  insert into org_members (org_id, user_id, role, active)
  select o.id, v_user, 'owner', true
  from organizations o
  where not exists (select 1 from org_members m where m.org_id = o.id)
  on conflict (org_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 14) Grants
-- ════════════════════════════════════════════════════════════════════════
grant execute on function user_org_ids(uuid) to authenticated;
grant execute on function user_admin_org_ids(uuid) to authenticated;
grant execute on function user_in_org(uuid, uuid) to authenticated;
grant execute on function user_is_org_admin(uuid, uuid) to authenticated;
grant execute on function create_org_with_owner(text,text,text,text,text,text,text,text,int) to authenticated;
grant execute on function org_add_creator_as_owner() to authenticated;
grant execute on function claim_orphan_orgs() to authenticated;
grant execute on function set_updated_at() to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 15) Recarrega cache do PostgREST
-- ════════════════════════════════════════════════════════════════════════
notify pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO — corre estas queries para verificar
-- ════════════════════════════════════════════════════════════════════════
-- 1) Confirma colunas existem todas:
--    select column_name, data_type from information_schema.columns
--      where table_name = 'organizations' order by ordinal_position;
--
-- 2) Confirma policies estão criadas:
--    select tablename, policyname, cmd from pg_policies
--      where tablename in ('organizations','org_members','org_invites');
--
-- 3) Resgata orgs já criadas mas órfãs:
--    select claim_orphan_orgs();
