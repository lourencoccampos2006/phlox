-- sprint37_payments.sql
-- Terminais / métodos de pagamento — MB WAY, Referência Multibanco e gateways
-- (SIBS, Easypay, Stripe) ligados pela instituição com a sua chave. O Phlox gera
-- o pedido / a referência e regista o estado na venda. RLS user_id = auth.uid().

create table if not exists payment_settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  provider     text default 'manual',   -- manual | mb_referencia | mbway | sibs | easypay | stripe
  api_key      text,
  entity       text,                     -- Entidade Multibanco (5 dígitos) p/ referências
  sub_entity   text,                     -- subentidade (3 dígitos), opcional
  terminal_id  text,                     -- ID do TPA, se aplicável
  default_method text default 'dinheiro',
  updated_at   timestamptz default now()
);
alter table payment_settings enable row level security;
do $$ begin create policy "payment_settings_own" on payment_settings for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- Campos de pagamento na venda
alter table sales add column if not exists pay_provider text;   -- provedor usado
alter table sales add column if not exists pay_ref      text;   -- referência MB / id do pedido MB WAY
alter table sales add column if not exists pay_entity   text;   -- entidade (referência MB)
alter table sales add column if not exists pay_status   text default 'pendente'; -- pendente | pago | expirado | erro
alter table sales add column if not exists mbway_phone  text;
