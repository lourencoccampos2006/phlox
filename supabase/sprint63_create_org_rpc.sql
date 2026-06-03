-- sprint63_create_org_rpc.sql
-- Phlox — Cria função SECURITY DEFINER que cria org + membership atómica.
--
-- Por que existe:
--   ─ A criação via INSERT directo + trigger AFTER funciona às vezes mas
--     deixa pendurados utilizadores sem membership em alguns ambientes
--     Supabase (auth.uid() inconsistente dentro de triggers). O resultado:
--     a org é criada mas o utilizador não aparece em org_members → /settings
--     mostra "Ainda não tens organizações".
--
--   ─ Esta RPC corre como SECURITY DEFINER, faz tudo numa única transacção
--     com o `auth.uid()` passado explicitamente, e devolve a org criada.
--     A API server-side passa a chamar isto em vez do INSERT directo.
--
-- 2026-06-03.

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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org  organizations;
begin
  -- Sanity: deve estar autenticado.
  if v_user is null then
    raise exception 'Não autenticado — auth.uid() é NULL.';
  end if;

  -- Sanity: kind aceitável.
  if p_kind not in ('hospital','clinic','nursing_home','pharmacy_community','pharmacy_hospital','health_center','solo','other') then
    raise exception 'Tipo inválido: %', p_kind;
  end if;

  -- Cria a org (defensivo: usa só colunas garantidas; columns extras serão
  -- preenchidas se existirem via UPDATE separado).
  insert into organizations (name, kind, short_name, vat_number, city, accent_color)
  values (
    nullif(trim(p_name), ''),
    p_kind,
    nullif(trim(p_short_name), ''),
    nullif(trim(p_vat_number), ''),
    nullif(trim(p_city), ''),
    coalesce(p_accent_color, '#0d6e42')
  )
  returning * into v_org;

  -- Actualiza colunas opcionais (defensivo a esquemas antigos).
  begin
    if p_logo_url is not null then
      update organizations set logo_url = p_logo_url where id = v_org.id;
    end if;
  exception when undefined_column then null; end;

  begin
    if p_director is not null then
      update organizations set director = p_director where id = v_org.id;
    end if;
  exception when undefined_column then null; end;

  begin
    if p_total_beds is not null then
      update organizations set total_beds = p_total_beds where id = v_org.id;
    end if;
  exception when undefined_column then null; end;

  -- Cria a membership de owner (idempotente caso o trigger também tenha
  -- corrido por trás das costas).
  insert into org_members (org_id, user_id, role, active)
  values (v_org.id, v_user, 'owner', true)
  on conflict (org_id, user_id) do update
    set role = 'owner', active = true;

  -- Devolve o estado final da org (com colunas extra preenchidas).
  select * into v_org from organizations where id = v_org.id;
  return v_org;
end;
$$;

grant execute on function create_org_with_owner(text,text,text,text,text,text,text,text,int) to authenticated;

-- Também garante que o trigger antigo continua a existir como fallback
-- (cintos e suspensórios). Se a RPC já criou a membership, o trigger faz
-- nada graças ao ON CONFLICT.
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

-- ─── Recuperação: associa o user actual a orgs sem owner (one-shot) ─────
-- Se já criaste orgs mas elas não aparecem, corre isto (em sessão autenticada):
--   select claim_orphan_orgs();
-- Vai atribuir-te como owner de todas as organizations que não têm membros.
create or replace function claim_orphan_orgs() returns int
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function claim_orphan_orgs() to authenticated;

notify pgrst, 'reload schema';

-- ─── DIAGNÓSTICO ─────────────────────────────────────────────────────────
-- Para confirmar que ficou a funcionar, depois de criares uma org via UI:
--   select id, name, kind from organizations order by created_at desc limit 5;
--   select user_id, role, org_id, active from org_members
--     where user_id = auth.uid() order by joined_at desc;
-- Devias ver pelo menos uma membership tua como owner.
