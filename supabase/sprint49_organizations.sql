-- sprint49_organizations.sql
-- Phlox — Fundação multi-organização.
--
-- Permite que um utilizador pertença a várias organizações (hospital + clínica
-- + farmácia) com role e capabilities distintas em cada uma. A "active org"
-- vive em localStorage no cliente; o backend valida sempre via org_members.
--
-- 2026-06-02.

-- ─── Tabela organizations ────────────────────────────────────────────────────
create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  short_name    text,
  kind          text not null check (kind in (
                  'hospital','clinic','nursing_home',
                  'pharmacy_community','pharmacy_hospital',
                  'health_center','solo','other'
                )),
  vat_number    text,
  logo_url      text,
  accent_color  text default '#0d6e42',
  address       text,
  postal_code   text,
  city          text,
  phone         text,
  email         text,
  metadata      jsonb default '{}'::jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Membros da organização ─────────────────────────────────────────────────
create table if not exists org_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in (
                  'owner','admin','clinician','pharmacist','nurse',
                  'assistant','accountant','viewer','student','caregiver','self'
                )),
  -- Override das capabilities default (null = usa defaults do role)
  capabilities  text[],
  department    text,
  active        boolean not null default true,
  invited_by    uuid references auth.users(id),
  joined_at     timestamptz not null default now(),
  unique(org_id, user_id)
);

create index if not exists org_members_user_idx on org_members(user_id) where active=true;
create index if not exists org_members_org_idx  on org_members(org_id) where active=true;

-- ─── Convites pendentes ─────────────────────────────────────────────────────
create table if not exists org_invites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  email         text not null,
  role          text not null check (role in (
                  'admin','clinician','pharmacist','nurse',
                  'assistant','accountant','viewer'
                )),
  department    text,
  invited_by    uuid not null references auth.users(id),
  token         text not null unique,                  -- url-safe random
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users(id),
  revoked       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists org_invites_token_idx on org_invites(token);
create index if not exists org_invites_email_idx on org_invites(lower(email), org_id) where accepted_at is null and revoked = false;

-- ─── active_org_id em profiles ──────────────────────────────────────────────
do $$ begin
  alter table profiles add column if not exists active_org_id uuid references organizations(id);
exception when undefined_table then null; end $$;

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table organizations enable row level security;
alter table org_members  enable row level security;
alter table org_invites  enable row level security;

-- Orgs: visíveis aos seus membros ativos
do $$ begin
  create policy "orgs_visible_to_members" on organizations for select
    using (id in (select org_id from org_members where user_id = auth.uid() and active=true));
exception when duplicate_object then null; end $$;

-- Orgs: editáveis por owners/admins
do $$ begin
  create policy "orgs_editable_by_admins" on organizations for update
    using (id in (select org_id from org_members where user_id = auth.uid() and role in ('owner','admin') and active=true));
exception when duplicate_object then null; end $$;

-- Orgs: qualquer utilizador autenticado pode criar (vira owner via trigger)
do $$ begin
  create policy "orgs_authenticated_create" on organizations for insert
    with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;

-- Membros visíveis aos colegas da mesma org
do $$ begin
  create policy "org_members_peers_visible" on org_members for select
    using (org_id in (select org_id from org_members where user_id = auth.uid() and active=true));
exception when duplicate_object then null; end $$;

-- Admins gerem membros
do $$ begin
  create policy "org_members_managed_by_admins" on org_members for all
    using (org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner','admin') and active=true))
    with check (org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner','admin') and active=true));
exception when duplicate_object then null; end $$;

-- Convites: visíveis a admins da mesma org
do $$ begin
  create policy "org_invites_admins_only" on org_invites for all
    using (org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner','admin') and active=true))
    with check (org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner','admin') and active=true));
exception when duplicate_object then null; end $$;

-- ─── Trigger: criador da org vira owner ─────────────────────────────────────
create or replace function org_add_creator_as_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into org_members (org_id, user_id, role) values (new.id, auth.uid(), 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists org_creator_owner on organizations;
create trigger org_creator_owner after insert on organizations
  for each row execute procedure org_add_creator_as_owner();

-- ─── Helper SQL: utilizador pertence à org? ─────────────────────────────────
create or replace function user_in_org(uid uuid, oid uuid) returns boolean
language sql stable as $$
  select exists(
    select 1 from org_members
    where user_id = uid and org_id = oid and active = true
  );
$$;

-- ─── updated_at automático ──────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists organizations_touch on organizations;
create trigger organizations_touch before update on organizations
  for each row execute procedure set_updated_at();
