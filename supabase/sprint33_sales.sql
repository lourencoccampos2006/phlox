-- sprint33_sales.sql
-- Receita transacional para instituições que NÃO faturam por mensalidade:
--   farmácia (vendas/dispensa ao balcão), clínica e centro de saúde (atos/recibos).
-- O lar continua a usar `billing_entries` (mensalidades). RLS user_id = auth.uid().

create table if not exists sales (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  at          timestamptz not null default now(),
  kind        text not null default 'venda',  -- venda | dispensa | ato | consulta | rastreio | outro
  description text,                             -- ex: "Paracetamol 1g x2", "Consulta de seguimento"
  person_name text,                             -- opcional (utente/doente; pode ser anónimo)
  patient_id  uuid,                             -- ligação opcional a ficha
  qty         numeric not null default 1,
  gross       numeric not null default 0,       -- valor bruto (€)
  discount    numeric not null default 0,       -- desconto (€)
  tax_rate    numeric not null default 0,       -- IVA % (ex: 6, 23)
  method      text default 'dinheiro',          -- dinheiro | multibanco | mbway | transferencia | comparticipado | isento
  paid        boolean not null default true,    -- venda ao balcão = paga; ato pode ficar pendente
  professional text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists sales_user_at_idx on sales(user_id, at);
alter table sales enable row level security;
do $$ begin create policy "sales_own" on sales for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
