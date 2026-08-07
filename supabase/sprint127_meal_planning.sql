-- sprint127_meal_planning.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: PRECISAS DE CORRER ISTO TU MESMO NO SUPABASE (SQL EDITOR).
-- Não apliquei — não toco no Supabase sem pedires (ver memória do projeto).
--
-- Reconstrução de /refeicoes pedida na auditoria: a versão anterior (sprint122)
-- era um registo de "quanto cada pessoa comeu por refeição" — isso já existe e
-- fica bem em /care-log (Registo). O que faltava de facto é uma ferramenta
-- INTERNA para a cozinha ORGANIZAR as refeições da semana/mês com antecedência,
-- com a IA a ajudar a escolher pratos respeitando alergias/orçamento — pedido
-- explícito do Fernando.
--
-- Duas tabelas:
--   meal_dishes       = biblioteca de pratos reutilizável (nome, alergénios,
--                        textura, tipo de dieta que serve, tier de custo).
--   meal_plan_entries = a grelha semanal em si (dia × refeição → prato).
-- Mesmo padrão de RLS (own + org_access + *_noviewer) já usado em
-- care_checklists/sprint123 e support_transport_schedules/sprint126.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists meal_dishes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete set null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  meal_types      text[],   -- subconjunto de: pequeno_almoco, almoco, lanche, jantar (null = qualquer)
  allergens       text[],   -- ex: {"glúten","lactose","marisco"}
  texture         text,     -- Normal | Mole | Triturada | Liquidificada | Pastosa | Picada (vocabulário de care_plans.diet_texture)
  diet_tags       text[],   -- ex: {"Hipossódica","Diabética"} (vocabulário de care_plans.diet_type)
  cost_tier       text default 'medio' check (cost_tier in ('baixo','medio','alto')),
  notes           text,
  active          boolean not null default true,
  recorded_by_id  uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index if not exists meal_dishes_org_idx on meal_dishes (org_id);

alter table meal_dishes enable row level security;
do $$ begin
  create policy "meal_dishes_own" on meal_dishes for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "meal_dishes_org_access" on meal_dishes for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;
do $$ begin
  execute $p$create policy "meal_dishes_ins_noviewer" on meal_dishes as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "meal_dishes_upd_noviewer" on meal_dishes as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "meal_dishes_del_noviewer" on meal_dishes as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

-- ── Grelha semanal ────────────────────────────────────────────────────────────
create table if not exists meal_plan_entries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete set null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            date not null,
  meal_type       text not null check (meal_type in ('pequeno_almoco','almoco','lanche','jantar')),
  dish_id         uuid references meal_dishes(id) on delete set null,
  dish_name_free  text,     -- prato fora da biblioteca (texto livre)
  notes           text,
  recorded_by_id  uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (org_id, user_id, date, meal_type)
);
create index if not exists meal_plan_entries_date_idx on meal_plan_entries (date);
create index if not exists meal_plan_entries_org_idx on meal_plan_entries (org_id);

alter table meal_plan_entries enable row level security;
do $$ begin
  create policy "meal_plan_entries_own" on meal_plan_entries for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "meal_plan_entries_org_access" on meal_plan_entries for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;
do $$ begin
  execute $p$create policy "meal_plan_entries_ins_noviewer" on meal_plan_entries as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "meal_plan_entries_upd_noviewer" on meal_plan_entries as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "meal_plan_entries_del_noviewer" on meal_plan_entries as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

notify pgrst, 'reload schema';
