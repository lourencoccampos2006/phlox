-- sprint141_daily_case_and_shift.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- Duas coisas:
--
-- 1) `profiles.daily_case_email` — quem quer receber o caso clínico do dia.
--    Por omissão NINGUÉM recebe: um email diário só se manda a quem o pediu.
--
-- 2) `shift_checkins` — quem ESTÁ na casa agora, não quem está escalado.
--    O Phlox sabia a escala mas não a realidade: se alguém troca um turno à
--    última hora, a passagem de turno e o "quem fez o quê" ficavam com o nome
--    errado. Com o check-in, o turno em curso é um facto e não uma previsão.
--
-- Seguro de correr mais do que uma vez.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles add column if not exists daily_case_email boolean not null default false;

create table if not exists shift_checkins (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  person_name  text,                       -- nome à data (sobrevive à saída da pessoa)
  date         date not null default current_date,
  shift        text not null default 'manha',
  entrou_at    timestamptz not null default now(),
  saiu_at      timestamptz,
  recorded_by_id uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
do $$ begin
  alter table shift_checkins add constraint shift_checkins_shift_check
    check (shift in ('manha','tarde','noite'));
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table shift_checkins add constraint shift_checkins_unique unique (user_id, date, shift);
exception when duplicate_object or duplicate_table then null; end $$;
create index if not exists shift_checkins_org_idx on shift_checkins (org_id, date desc);

alter table shift_checkins enable row level security;
do $$ begin
  create policy "shift_checkins_own" on shift_checkins for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "shift_checkins_org" on shift_checkins for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
