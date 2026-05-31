-- sprint40_api_keys.sql
-- API pública do Phlox — chaves de API rotáveis com SCOPES e rate limit por chave.
-- A chave é mostrada UMA SÓ VEZ ao criar; em BD guarda-se apenas o hash SHA-256 + prefixo.
-- RLS: o dono vê só as SUAS chaves.

create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,                  -- rótulo amigável
  prefix       text not null,                  -- ex: "pk_live_" + 8 chars (usado no display + lookup)
  hash         text not null,                  -- SHA-256 hex do segredo completo (nunca o segredo)
  scopes       text[] not null default '{}',   -- ex: {sales:read, stock:write}
  active       boolean not null default true,
  last_used_at timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists api_keys_user_idx on api_keys(user_id);
create index if not exists api_keys_prefix_idx on api_keys(prefix);
alter table api_keys enable row level security;
do $$ begin create policy "api_keys_own" on api_keys for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- Uso (para rate limit por chave e analytics futuro)
create table if not exists api_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  key_id      uuid references api_keys(id) on delete cascade,
  at          timestamptz not null default now(),
  path        text,
  method      text,
  status      int,
  ms          int
);
create index if not exists api_usage_user_idx on api_usage(user_id, at);
create index if not exists api_usage_key_idx on api_usage(key_id, at);
alter table api_usage enable row level security;
do $$ begin create policy "api_usage_read_own" on api_usage for select using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
