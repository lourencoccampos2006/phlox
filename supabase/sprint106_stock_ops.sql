-- sprint106_stock_ops.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RONDA 13 — Stock operacional fácil (lar / centro de dia).
-- • Consumo a 1 toque (luvas, fraldas…) sem fricção — regista e desconta.
-- • Estado de reposição: ok → pedido → encomendado → repõe. Assim o funcionário
--   que nota o stock baixo envia UMA vez; o responsável encomenda e marca
--   "encomendado"; o próximo já vê que está tratado e não reenvia.
-- • Fornecedor + link de compra por item (aparecem no painel do dono).
-- 2026-07-05. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Novos campos no stock_items (org_id já vem do sprint97).
alter table if exists stock_items add column if not exists reorder_status text not null default 'ok'
  check (reorder_status in ('ok','requested','ordered'));
alter table if exists stock_items add column if not exists supplier_name text;
alter table if exists stock_items add column if not exists supplier_contact text;
alter table if exists stock_items add column if not exists buy_url text;
alter table if exists stock_items add column if not exists unit_cost numeric;      -- custo por unidade (p/ despesa automática)
alter table if exists stock_items add column if not exists reorder_note text;       -- o que o funcionário escreveu ao pedir
alter table if exists stock_items add column if not exists reorder_at timestamptz;  -- quando foi pedido/encomendado

-- Registo de consumo (auditável, org-scoped). Cada toque deixa rasto de quem/quanto.
create table if not exists stock_consumption (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid references organizations(id) on delete set null,
  item_id      uuid not null references stock_items(id) on delete cascade,
  qty          numeric not null default 1,
  by_name      text,
  created_at   timestamptz not null default now()
);
create index if not exists sc_org_idx on stock_consumption (org_id, created_at desc) where org_id is not null;
create index if not exists sc_item_idx on stock_consumption (item_id, created_at desc);

alter table stock_consumption enable row level security;
do $$ begin
  create policy "sc_own" on stock_consumption for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sc_org_access" on stock_consumption for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table stock_consumption; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table stock_items; exception when others then null; end $$;
