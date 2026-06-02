-- sprint57_pharmacy_erp.sql
-- Phlox — Farmácia ERP: fornecedores, encomendas, recepção, fidelização.
--
-- Modelo:
--   ─ suppliers            (fornecedores: laboratórios, armazenistas)
--   ─ purchase_orders      (encomendas + linhas)
--   ─ purchase_order_items
--   ─ goods_receipts       (recepção de mercadoria + linhas)
--   ─ goods_receipt_items
--   ─ loyalty_programs     (programas: ex. "Cartão Saúde")
--   ─ loyalty_members      (clientes inscritos)
--   ─ loyalty_transactions (acumulação e resgate de pontos)
--   ─ loyalty_rewards      (catálogo de recompensas)
--
-- Multi-org via org_id. Capabilities: stock.purchase (já existe) cobre compras,
-- loyalty.read/write para fidelização. 2026-06-02.

-- ─── Capabilities adicionais ──────────────────────────────────────────────
insert into capability_catalog (key, category, label, description, level) values
  ('loyalty.read',   'pharmacy', 'Ver fidelização',     'Consulta clientes, pontos e recompensas',   'read'),
  ('loyalty.write',  'pharmacy', 'Gerir fidelização',   'Inscreve clientes, atribui pontos, troca',  'write'),
  ('suppliers.read', 'pharmacy', 'Ver fornecedores',    '',                                          'read'),
  ('suppliers.write','pharmacy', 'Gerir fornecedores',  '',                                          'write')
  on conflict (key) do nothing;

-- Refresh defaults: pharmacist/admin recebem as novas; viewer só read
create or replace function default_capabilities(role text) returns text[]
language plpgsql immutable as $$
begin
  return case role
    when 'owner' then array(select key from capability_catalog)
    when 'admin' then
      array['patients.read','patients.write','patients.delete',
            'episodes.read','episodes.write',
            'prescription.read','prescription.validate',
            'mar.read','rounds.read','rounds.write',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'billing.read','billing.write','billing.fiscal_export','pos.use',
            'team.read','team.manage','team.schedule',
            'quality.read','quality.write','audit.read','org.admin',
            'beds.read','beds.write','triage.read','surgery.read','surgery.write',
            'suppliers.read','suppliers.write','loyalty.read','loyalty.write']
    when 'clinician' then
      array['patients.read','patients.write',
            'episodes.read','episodes.write',
            'prescription.read','prescription.write',
            'mar.read','rounds.read','rounds.write',
            'quality.read','team.read',
            'beds.read','beds.write','triage.read','triage.write',
            'surgery.read','surgery.write']
    when 'pharmacist' then
      array['patients.read',
            'prescription.read','prescription.validate',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'rounds.read','rounds.write',
            'billing.read','billing.write','pos.use',
            'quality.read','team.read',
            'beds.read',
            'suppliers.read','suppliers.write','loyalty.read','loyalty.write']
    when 'nurse' then
      array['patients.read','patients.write','episodes.read',
            'prescription.read','mar.read','mar.administer',
            'rounds.read','quality.write','team.read',
            'beds.read','beds.write','triage.read','triage.write','surgery.read']
    when 'assistant' then
      array['patients.read','episodes.read',
            'billing.read','billing.write','pos.use','team.read','beds.read',
            'loyalty.read','loyalty.write']
    when 'accountant' then
      array['billing.read','billing.write','billing.fiscal_export','org.billing_settings',
            'suppliers.read']
    when 'viewer' then
      array['patients.read','episodes.read','prescription.read',
            'mar.read','rounds.read','stock.read','billing.read',
            'team.read','quality.read',
            'beds.read','triage.read','surgery.read',
            'suppliers.read','loyalty.read']
    when 'student' then
      array['patients.read','prescription.read','mar.read','rounds.read',
            'beds.read','triage.read','surgery.read']
    when 'caregiver' then array['patients.read','mar.read','mar.administer']
    when 'self'      then array['patients.read']
    else array[]::text[]
  end;
end;
$$;

-- ─── Suppliers ───────────────────────────────────────────────────────────
create table if not exists suppliers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  short_name    text,
  kind          text not null default 'wholesaler' check (kind in (
                  'wholesaler','laboratory','distributor','direct','other'
                )),
  vat_number    text,                                  -- NIF
  -- Identificadores nacionais (Portugal)
  infarmed_code text,                                  -- código INFARMED do operador
  edi_code      text,                                  -- código EDI (Alliance, OCP, Plural, etc.)
  contact_name  text,
  email         text,
  phone         text,
  address       text,
  postal_code   text,
  city          text,
  -- Comerciais
  payment_terms text,                                  -- ex: "30 dias", "Pronto pagamento"
  discount_pct  numeric(5,2) default 0,                -- desconto-base
  -- Logística
  lead_time_days int default 1,                        -- dias até entrega
  min_order_value numeric(10,2),
  cutoff_time   time,                                  -- hora limite para pedir hoje
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists suppliers_org_idx on suppliers(org_id) where active = true;

drop trigger if exists suppliers_touch on suppliers;
create trigger suppliers_touch before update on suppliers
  for each row execute procedure set_updated_at();

-- ─── Purchase orders (encomendas) ────────────────────────────────────────
create table if not exists purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  supplier_id     uuid not null references suppliers(id) on delete restrict,
  number          text,                                -- nº interno (gera-se)
  status          text not null default 'draft' check (status in (
                    'draft','sent','partial','received','cancelled'
                  )),
  ordered_at      timestamptz,
  expected_at     timestamptz,                         -- entrega prevista
  received_at     timestamptz,
  -- Totais (atualizados via trigger ao alterar linhas)
  total_qty       numeric(12,2) default 0,
  total_lines     int default 0,
  total_amount    numeric(12,2) default 0,             -- valor (s/IVA)
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists po_org_status_idx on purchase_orders(org_id, status, created_at desc);
create index if not exists po_supplier_idx on purchase_orders(supplier_id, created_at desc);

drop trigger if exists po_touch on purchase_orders;
create trigger po_touch before update on purchase_orders
  for each row execute procedure set_updated_at();

-- Numeração simples por org (ex: PO-2026-0001)
create or replace function po_set_number() returns trigger
language plpgsql as $$
declare
  yr int := extract(year from now());
  seq int;
begin
  if new.number is null then
    select count(*) + 1 into seq
      from purchase_orders
      where org_id = new.org_id
        and extract(year from created_at) = yr;
    new.number := 'PO-' || yr || '-' || lpad(seq::text, 4, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists po_number on purchase_orders;
create trigger po_number before insert on purchase_orders
  for each row execute procedure po_set_number();

-- Linhas
create table if not exists purchase_order_items (
  id              uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  -- O produto pode estar no catálogo Phlox (drug_id) ou ser texto livre
  drug_id         uuid,                                -- ref. opcional drugs(id)
  ean             text,                                -- código de barras
  cnpem           text,                                -- código nacional INFARMED
  product_name    text not null,                       -- redundância p/ histórico
  qty             numeric(10,2) not null,
  unit_price      numeric(10,4) not null default 0,
  discount_pct    numeric(5,2) default 0,
  vat_rate        numeric(5,2) default 6,              -- IVA medicamentos
  qty_received    numeric(10,2) not null default 0,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists poi_po_idx on purchase_order_items(purchase_order_id);

-- Trigger: actualiza totais do PO ao mexer numa linha
create or replace function po_recalc_totals() returns trigger
language plpgsql as $$
declare
  pid uuid := coalesce(new.purchase_order_id, old.purchase_order_id);
begin
  update purchase_orders po set
    total_qty   = coalesce((select sum(qty) from purchase_order_items where purchase_order_id = pid), 0),
    total_lines = coalesce((select count(*) from purchase_order_items where purchase_order_id = pid), 0),
    total_amount= coalesce((select sum(qty * unit_price * (1 - coalesce(discount_pct,0)/100))
                            from purchase_order_items where purchase_order_id = pid), 0)
  where po.id = pid;
  return coalesce(new, old);
end;
$$;
drop trigger if exists poi_recalc_iud on purchase_order_items;
create trigger poi_recalc_iud after insert or update or delete on purchase_order_items
  for each row execute procedure po_recalc_totals();

-- ─── Goods receipts (recepção de mercadoria) ─────────────────────────────
create table if not exists goods_receipts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  supplier_id     uuid not null references suppliers(id) on delete restrict,
  purchase_order_id uuid references purchase_orders(id) on delete set null,
  number          text,
  invoice_number  text,                                -- nº de factura do fornecedor
  invoice_date    date,
  received_at     timestamptz not null default now(),
  received_by     uuid references auth.users(id),
  status          text not null default 'pending' check (status in (
                    'pending','validated','rejected'
                  )),
  total_amount    numeric(12,2) default 0,
  total_lines     int default 0,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists gr_org_idx on goods_receipts(org_id, received_at desc);
create index if not exists gr_po_idx on goods_receipts(purchase_order_id);

create or replace function gr_set_number() returns trigger
language plpgsql as $$
declare yr int := extract(year from now()); seq int;
begin
  if new.number is null then
    select count(*) + 1 into seq from goods_receipts
      where org_id = new.org_id and extract(year from created_at) = yr;
    new.number := 'GR-' || yr || '-' || lpad(seq::text, 4, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists gr_number on goods_receipts;
create trigger gr_number before insert on goods_receipts
  for each row execute procedure gr_set_number();

create table if not exists goods_receipt_items (
  id              uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references goods_receipts(id) on delete cascade,
  purchase_order_item_id uuid references purchase_order_items(id) on delete set null,
  drug_id         uuid,
  ean             text,
  product_name    text not null,
  qty             numeric(10,2) not null,
  unit_price      numeric(10,4) not null default 0,
  batch_number    text,                                -- lote
  expiry_date     date,                                -- validade
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists gri_gr_idx on goods_receipt_items(goods_receipt_id);

-- Ao inserir linha de recepção, soma ao qty_received da linha de encomenda
create or replace function gri_update_po_received() returns trigger
language plpgsql as $$
begin
  if new.purchase_order_item_id is not null then
    update purchase_order_items
       set qty_received = coalesce(qty_received, 0) + new.qty
     where id = new.purchase_order_item_id;
    -- Marca PO como recebida/parcial
    update purchase_orders po set status =
      case when (select bool_and(qty_received >= qty)
                   from purchase_order_items where purchase_order_id = po.id)
           then 'received' else 'partial' end,
      received_at = case when (select bool_and(qty_received >= qty)
                                  from purchase_order_items where purchase_order_id = po.id)
                         then now() else po.received_at end
     where po.id = (select purchase_order_id from purchase_order_items where id = new.purchase_order_item_id);
  end if;
  return new;
end;
$$;
drop trigger if exists gri_update_po on goods_receipt_items;
create trigger gri_update_po after insert on goods_receipt_items
  for each row execute procedure gri_update_po_received();

-- Totais da recepção
create or replace function gr_recalc_totals() returns trigger
language plpgsql as $$
declare gid uuid := coalesce(new.goods_receipt_id, old.goods_receipt_id);
begin
  update goods_receipts gr set
    total_lines = coalesce((select count(*) from goods_receipt_items where goods_receipt_id = gid), 0),
    total_amount= coalesce((select sum(qty * unit_price) from goods_receipt_items where goods_receipt_id = gid), 0)
  where gr.id = gid;
  return coalesce(new, old);
end;
$$;
drop trigger if exists gri_recalc_iud on goods_receipt_items;
create trigger gri_recalc_iud after insert or update or delete on goods_receipt_items
  for each row execute procedure gr_recalc_totals();

-- ─── Loyalty (fidelização) ───────────────────────────────────────────────
create table if not exists loyalty_programs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  description   text,
  -- Regras
  points_per_euro numeric(6,2) not null default 1,     -- ex: 1 pt por € gasto
  euro_per_point  numeric(8,4) not null default 0.01,  -- ex: 1 pt = 1 cêntimo
  min_redeem_pts int default 100,                      -- mínimo p/ trocar
  expiry_months  int default 12,                       -- pontos expiram após X meses
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists lp_org_idx on loyalty_programs(org_id) where active = true;

create table if not exists loyalty_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  program_id    uuid not null references loyalty_programs(id) on delete cascade,
  -- Identificação do cliente (sem PII obrigatória)
  card_number   text,                                  -- nº cartão / leitor
  name          text not null,
  phone         text,
  email         text,
  birth_date    date,
  vat_number    text,                                  -- NIF para benefícios fiscais
  -- Saldo (denormalizado, mantido por trigger)
  points_balance int not null default 0,
  total_earned  int not null default 0,
  total_redeemed int not null default 0,
  total_spent   numeric(12,2) default 0,               -- valor total gasto
  consent_marketing boolean default false,
  active        boolean not null default true,
  joined_at     timestamptz not null default now(),
  last_visit_at timestamptz
);
create unique index if not exists lm_org_card_unq on loyalty_members(org_id, card_number) where card_number is not null;
create index if not exists lm_org_idx on loyalty_members(org_id) where active = true;
create index if not exists lm_phone_idx on loyalty_members(org_id, phone) where phone is not null;

create table if not exists loyalty_transactions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  member_id     uuid not null references loyalty_members(id) on delete cascade,
  kind          text not null check (kind in ('earn','redeem','adjust','expire')),
  points        int not null,                          -- positivo: earn/adjust+, negativo: redeem/expire/adjust-
  amount        numeric(10,2),                         -- valor da compra (se earn)
  reward_id     uuid,                                  -- ref. loyalty_rewards (se redeem)
  reward_name   text,                                  -- snapshot
  note          text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index if not exists lt_member_idx on loyalty_transactions(member_id, created_at desc);

create table if not exists loyalty_rewards (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  program_id    uuid not null references loyalty_programs(id) on delete cascade,
  name          text not null,
  description   text,
  points_cost   int not null,
  stock         int,                                   -- null = ilimitado
  redeemed_count int default 0,
  active        boolean not null default true,
  image_url     text,
  created_at    timestamptz not null default now()
);
create index if not exists lr_program_idx on loyalty_rewards(program_id) where active = true;

-- Trigger: actualiza balance e totais do membro a cada transacção
create or replace function loyalty_update_balance() returns trigger
language plpgsql as $$
declare mid uuid := coalesce(new.member_id, old.member_id);
begin
  update loyalty_members m set
    points_balance = coalesce((select sum(points) from loyalty_transactions where member_id = mid), 0),
    total_earned   = coalesce((select sum(points) from loyalty_transactions where member_id = mid and points > 0 and kind in ('earn','adjust')), 0),
    total_redeemed = coalesce(abs((select sum(points) from loyalty_transactions where member_id = mid and points < 0 and kind = 'redeem')), 0),
    total_spent    = coalesce((select sum(amount) from loyalty_transactions where member_id = mid and kind = 'earn' and amount is not null), 0),
    last_visit_at  = greatest(coalesce(m.last_visit_at, now()), now())
  where m.id = mid;
  -- Conta resgates
  if (new.kind = 'redeem' and new.reward_id is not null) then
    update loyalty_rewards set redeemed_count = redeemed_count + 1 where id = new.reward_id;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists lt_balance_iud on loyalty_transactions;
create trigger lt_balance_iud after insert or update or delete on loyalty_transactions
  for each row execute procedure loyalty_update_balance();

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table suppliers              enable row level security;
alter table purchase_orders        enable row level security;
alter table purchase_order_items   enable row level security;
alter table goods_receipts         enable row level security;
alter table goods_receipt_items    enable row level security;
alter table loyalty_programs       enable row level security;
alter table loyalty_members        enable row level security;
alter table loyalty_transactions   enable row level security;
alter table loyalty_rewards        enable row level security;

-- Suppliers
do $$ begin
  create policy "suppliers_read" on suppliers for select
    using (has_capability(auth.uid(), org_id, 'suppliers.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "suppliers_write" on suppliers for all
    using (has_capability(auth.uid(), org_id, 'suppliers.write'))
    with check (has_capability(auth.uid(), org_id, 'suppliers.write'));
exception when duplicate_object then null; end $$;

-- Purchase orders & items (via stock.purchase)
do $$ begin
  create policy "po_read" on purchase_orders for select
    using (has_capability(auth.uid(), org_id, 'stock.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "po_write" on purchase_orders for all
    using (has_capability(auth.uid(), org_id, 'stock.purchase'))
    with check (has_capability(auth.uid(), org_id, 'stock.purchase'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "poi_read" on purchase_order_items for select
    using (purchase_order_id in (
      select id from purchase_orders where has_capability(auth.uid(), org_id, 'stock.read')
    ));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "poi_write" on purchase_order_items for all
    using (purchase_order_id in (
      select id from purchase_orders where has_capability(auth.uid(), org_id, 'stock.purchase')
    ))
    with check (purchase_order_id in (
      select id from purchase_orders where has_capability(auth.uid(), org_id, 'stock.purchase')
    ));
exception when duplicate_object then null; end $$;

-- Goods receipts (precisam de stock.write)
do $$ begin
  create policy "gr_read" on goods_receipts for select
    using (has_capability(auth.uid(), org_id, 'stock.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "gr_write" on goods_receipts for all
    using (has_capability(auth.uid(), org_id, 'stock.write'))
    with check (has_capability(auth.uid(), org_id, 'stock.write'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "gri_read" on goods_receipt_items for select
    using (goods_receipt_id in (
      select id from goods_receipts where has_capability(auth.uid(), org_id, 'stock.read')
    ));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "gri_write" on goods_receipt_items for all
    using (goods_receipt_id in (
      select id from goods_receipts where has_capability(auth.uid(), org_id, 'stock.write')
    ))
    with check (goods_receipt_id in (
      select id from goods_receipts where has_capability(auth.uid(), org_id, 'stock.write')
    ));
exception when duplicate_object then null; end $$;

-- Loyalty (programs/rewards são "config" → write requer admin)
do $$ begin
  create policy "lp_read" on loyalty_programs for select
    using (has_capability(auth.uid(), org_id, 'loyalty.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "lp_write" on loyalty_programs for all
    using (has_capability(auth.uid(), org_id, 'org.admin'))
    with check (has_capability(auth.uid(), org_id, 'org.admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lr_read" on loyalty_rewards for select
    using (has_capability(auth.uid(), org_id, 'loyalty.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "lr_write" on loyalty_rewards for all
    using (has_capability(auth.uid(), org_id, 'org.admin'))
    with check (has_capability(auth.uid(), org_id, 'org.admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lm_read" on loyalty_members for select
    using (has_capability(auth.uid(), org_id, 'loyalty.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "lm_write" on loyalty_members for all
    using (has_capability(auth.uid(), org_id, 'loyalty.write'))
    with check (has_capability(auth.uid(), org_id, 'loyalty.write'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lt_read" on loyalty_transactions for select
    using (has_capability(auth.uid(), org_id, 'loyalty.read'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "lt_write" on loyalty_transactions for all
    using (has_capability(auth.uid(), org_id, 'loyalty.write'))
    with check (has_capability(auth.uid(), org_id, 'loyalty.write'));
exception when duplicate_object then null; end $$;

-- ─── Vistas de apoio ─────────────────────────────────────────────────────
-- KPIs do fornecedor (entregas, valor, lead time real)
create or replace view supplier_kpis as
  select
    s.id          as supplier_id,
    s.org_id,
    s.name,
    count(po.id)                                              as orders_count,
    coalesce(sum(po.total_amount), 0)                         as total_value,
    avg(extract(epoch from (po.received_at - po.ordered_at)) / 86400.0)
      filter (where po.received_at is not null and po.ordered_at is not null) as avg_lead_days,
    count(po.id) filter (where po.status = 'received')        as orders_received,
    count(po.id) filter (where po.status in ('sent','partial')) as orders_open
  from suppliers s
  left join purchase_orders po on po.supplier_id = s.id
  where s.active = true
  group by s.id, s.org_id, s.name;
