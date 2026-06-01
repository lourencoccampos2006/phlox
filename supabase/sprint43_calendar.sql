-- sprint43_calendar.sql
-- Phlox Calendário pessoal — consultas, lembretes, eventos próprios do utilizador.
-- Simples mas suficiente: título, datas, descrição, tipo, lembrete.
-- RLS: cada utilizador vê só os seus.

create table if not exists cal_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  description  text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  kind         text not null default 'event'
                check (kind in ('consulta','exame','medicacao','lembrete','event')),
  location     text,
  remind_minutes_before int,                  -- null = sem lembrete
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists cal_events_user_idx on cal_events(user_id, starts_at);
alter table cal_events enable row level security;
do $$ begin
  create policy "cal_events_own" on cal_events for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
