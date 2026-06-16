-- sprint88_usage_counters.sql
-- Contadores de uso DIÁRIO por utilizador e ferramenta, persistidos no servidor.
-- Substitui a contagem client-side (localStorage), que era contornável.
-- A RPC increment_usage faz check-and-increment ATÓMICO e devolve o total do dia.

create table if not exists usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_key text not null,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, tool_key, day)
);

alter table usage_counters enable row level security;

-- O utilizador só vê os seus próprios contadores (leitura; escrita é via RPC SECURITY DEFINER).
do $$ begin
  create policy usage_counters_own on usage_counters for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Incremento atómico. Devolve o NOVO total do dia para a ferramenta.
-- SECURITY DEFINER para poder escrever ignorando RLS, mas só escreve para o
-- user_id passado (que o caller valida com getUserPlan antes de chamar).
create or replace function increment_usage(p_user uuid, p_key text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_day date := (now() at time zone 'utc')::date;
begin
  insert into usage_counters (user_id, tool_key, day, count, updated_at)
  values (p_user, p_key, v_day, 1, now())
  on conflict (user_id, tool_key, day)
  do update set count = usage_counters.count + 1, updated_at = now()
  returning count into v_count;
  return v_count;
end;
$$;

-- Leitura do total atual sem incrementar (para mostrar "restantes" se preciso).
create or replace function get_usage(p_user uuid, p_key text)
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select count from usage_counters
     where user_id = p_user and tool_key = p_key
       and day = (now() at time zone 'utc')::date), 0);
$$;

grant execute on function increment_usage(uuid, text) to authenticated, anon;
grant execute on function get_usage(uuid, text) to authenticated, anon;
