-- sprint34_pos.sql
-- Sistema de vendas (POS) avançado, integrado e MEGA-COMPATÍVEL com software de
-- faturação certificado (não emite fiscalmente — exporta/conecta).
-- Estende stock para código de barras + preços; linhas de venda; definições de
-- integração de faturação; e auditoria de exportações/emissões.
-- RLS user_id = auth.uid() em tudo.

-- ── Stock: código de barras + preços (idempotente sobre stock_items existente) ──
alter table stock_items add column if not exists barcode    text;        -- EAN-13 / CNP (farmácia) / código interno
alter table stock_items add column if not exists price      numeric default 0;   -- PVP (preço de venda c/ IVA)
alter table stock_items add column if not exists cost       numeric default 0;   -- preço de custo
alter table stock_items add column if not exists tax_rate   numeric default 23;  -- IVA % do produto
alter table stock_items add column if not exists ref        text;        -- referência interna / SKU
create index if not exists stock_items_barcode_idx on stock_items(user_id, barcode);

-- ── Linhas de venda (cada produto/serviço de uma venda) ────────────────────────
create table if not exists sale_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  sale_id     uuid not null references sales(id) on delete cascade,
  stock_id    uuid,                              -- ligação opcional ao produto em stock
  barcode     text,
  name        text not null,
  qty         numeric not null default 1,
  unit_price  numeric not null default 0,        -- preço unitário c/ IVA
  discount    numeric not null default 0,        -- desconto da linha (€)
  tax_rate    numeric not null default 23,
  created_at  timestamptz not null default now()
);
create index if not exists sale_items_sale_idx on sale_items(sale_id);
create index if not exists sale_items_user_idx on sale_items(user_id);
alter table sale_items enable row level security;
do $$ begin create policy "sale_items_own" on sale_items for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── Campos fiscais/POS adicionais na venda ─────────────────────────────────────
alter table sales add column if not exists doc_number   text;   -- nº do documento no software certificado (após emissão/lançamento)
alter table sales add column if not exists nif          text;   -- NIF do cliente (para fatura com contribuinte)
alter table sales add column if not exists exported     boolean default false;
alter table sales add column if not exists export_ref   text;   -- id externo (InvoiceXpress/Moloni/Vendus) ou ficheiro
alter table sales add column if not exists provider     text;   -- provedor usado na emissão/export

-- ── Definições de integração de faturação (1 por utilizador) ───────────────────
create table if not exists invoice_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  provider    text default 'export',  -- export | invoicexpress | moloni | vendus | sage_csv | phc_csv
  api_key     text,                    -- chave/token da API do provedor (se aplicável)
  account_id  text,                    -- conta/empresa no provedor
  doc_type    text default 'fatura_recibo', -- fatura_recibo | fatura_simplificada | recibo | venda_dinheiro
  series      text,
  auto_emit   boolean default false,   -- emitir automaticamente ao finalizar a venda
  default_tax numeric default 23,
  updated_at  timestamptz default now()
);
alter table invoice_settings enable row level security;
do $$ begin create policy "invoice_settings_own" on invoice_settings for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── Auditoria de exportações/emissões fiscais ──────────────────────────────────
create table if not exists fiscal_exports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  at          timestamptz not null default now(),
  kind        text not null default 'csv',   -- csv | saft | invoicexpress | moloni | vendus
  period_from date,
  period_to   date,
  rows        integer default 0,
  total       numeric default 0,
  ref         text,                            -- referência externa / nome do ficheiro
  status      text default 'ok',               -- ok | error
  detail      text
);
create index if not exists fiscal_exports_user_idx on fiscal_exports(user_id, at);
alter table fiscal_exports enable row level security;
do $$ begin create policy "fiscal_exports_own" on fiscal_exports for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
