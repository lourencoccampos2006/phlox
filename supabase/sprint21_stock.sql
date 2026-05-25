-- Sprint 21: Stock & Validades de Medicação (funcionalidade do Painel de Gestão)
-- Run in Supabase SQL Editor

create table if not exists stock_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  category text default 'medicamento'
    check (category in ('medicamento','penso','material','suplemento','outro')),
  quantity numeric not null default 0,
  unit text default 'un',
  min_quantity numeric default 0,    -- limiar de reposição
  expiry_date date,
  location text,
  notes text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table stock_items enable row level security;
do $$ begin
  create policy "stock_items_own" on stock_items for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
create index if not exists stock_items_user_idx on stock_items(user_id, expiry_date);
