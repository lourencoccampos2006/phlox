-- sprint36_webhooks.sql
-- Webhooks de saída — o Phlox dispara eventos para um URL configurável (Zapier, Make,
-- ERP próprio, etc.). Cada evento é assinado com HMAC-SHA256 (cabeçalho X-Phlox-Signature).
-- RLS user_id = auth.uid().

create table if not exists webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  url         text not null,
  secret      text not null,                  -- segredo p/ assinatura HMAC
  events      text[] not null default '{}',   -- ex: {sale.created, stock.low, document.issued}
  active      boolean not null default true,
  description text,
  created_at  timestamptz not null default now(),
  last_status int,
  last_at     timestamptz
);
create index if not exists webhook_endpoints_user_idx on webhook_endpoints(user_id);
alter table webhook_endpoints enable row level security;
do $$ begin create policy "webhook_endpoints_own" on webhook_endpoints for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

create table if not exists webhook_deliveries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint_id uuid references webhook_endpoints(id) on delete cascade,
  event       text not null,
  at          timestamptz not null default now(),
  status      int,                            -- HTTP status (ou 0 = erro de rede)
  ok          boolean default false,
  response    text
);
create index if not exists webhook_deliveries_user_idx on webhook_deliveries(user_id, at);
alter table webhook_deliveries enable row level security;
do $$ begin create policy "webhook_deliveries_own" on webhook_deliveries for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
