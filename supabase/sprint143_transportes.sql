-- sprint143_transportes.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: PRECISAS DE CORRER ISTO NO SUPABASE (SQL EDITOR).
-- Não apliquei — não toco no Supabase sem pedires.
--
-- O /apoio-servicos tinha UM tipo de transporte só, e pedia uma hora a cada
-- pessoa. Isso está errado para o caso mais comum: num circuito casa-centro-casa
-- o motorista sai a uma hora e vai recolhendo toda a gente — a hora a que chega
-- a cada porta é uma consequência da rota, não uma decisão de quem organiza.
--
-- Esta migração traz duas coisas:
--
--   1. `kind` nos horários: circuito | consulta | passeio | pontual.
--      Cada um tem regras próprias (o circuito não pede horas; a consulta pede,
--      porque há um médico à espera).
--
--   2. `support_transport_routes`: o circuito em si. É aqui que vive a HORA DE
--      PARTIDA, uma por circuito e não uma por pessoa. Com ela e com os tempos
--      de estrada reais, as chegadas saem calculadas (ver lib/rotaTransporte,
--      horariosDoCircuito).
--
-- Nota de idempotência: o `exception when duplicate_object` NÃO apanha o 42P07
-- (duplicate_table), que é o que uma constraint única levanta ao criar o índice.
-- Daí o `duplicate_object or duplicate_table` em todo o lado — foi o que matou
-- o sprint131 a meio e deixou tabelas sem RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Os circuitos ─────────────────────────────────────────────────────────
create table if not exists support_transport_routes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete set null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  nome            text not null,                      -- "Circuito da manhã"
  direcao         text not null default 'recolha',    -- 'recolha' (casa→centro) | 'entrega' (centro→casa)
  hora_partida    text not null default '08:00',      -- "HH:MM" — a ÚNICA hora que alguém escreve
  minutos_paragem integer not null default 3,         -- quanto demora a recolher cada pessoa à porta
  weekdays        integer[],                          -- null = todos os dias; senão 0(domingo)-6(sábado)
  notes           text,
  active          boolean not null default true,
  recorded_by_id  uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index if not exists support_transport_routes_org_idx on support_transport_routes (org_id, active);

alter table support_transport_routes enable row level security;

do $$ begin
  create policy "support_transport_routes_own" on support_transport_routes for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  create policy "support_transport_routes_org_access" on support_transport_routes for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  execute $p$create policy "support_transport_routes_ins_noviewer" on support_transport_routes as restrictive for insert
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_transport_routes_upd_noviewer" on support_transport_routes as restrictive for update
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))
    with check (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;
do $$ begin
  execute $p$create policy "support_transport_routes_del_noviewer" on support_transport_routes as restrictive for delete
    using (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid() and active = true and role <> 'viewer'))$p$;
exception when others then null; end $$;

-- ── 2. O tipo de cada horário ───────────────────────────────────────────────
-- 'circuito' por omissão: tudo o que já lá está é transporte casa↔centro, que
-- era o único que existia. Ninguém perde nada.
alter table if exists support_transport_schedules
  add column if not exists kind text not null default 'circuito';

alter table if exists support_transport_schedules
  add column if not exists route_id uuid references support_transport_routes(id) on delete set null;

-- A morada de destino, para consultas e passeios: no circuito o destino é
-- sempre a casa, mas uma consulta é no hospital e um passeio é noutro sítio.
alter table if exists support_transport_schedules
  add column if not exists destino text;

-- Para os pedidos pontuais, que acontecem num dia e não se repetem.
alter table if exists support_transport_schedules
  add column if not exists data date;

create index if not exists support_transport_schedules_kind_idx
  on support_transport_schedules (org_id, kind, active);

do $$ begin
  alter table support_transport_schedules
    add constraint support_transport_schedules_kind_chk
    check (kind in ('circuito', 'consulta', 'passeio', 'pontual'));
exception when duplicate_object or duplicate_table or check_violation then null; end $$;
