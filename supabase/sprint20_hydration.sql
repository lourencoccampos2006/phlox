-- Sprint 20: Hidratação & Eliminação (balanço hídrico + dejeções)
-- Run in Supabase SQL Editor

create table if not exists hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('fluid','bowel','urine')),
  fluid_ml int,          -- para kind = 'fluid'
  bristol int,           -- 1-7, para kind = 'bowel'
  urine text,            -- normal | reduzida | incontinencia, para kind = 'urine'
  notes text,
  recorded_by text,
  created_at timestamptz default now()
);
alter table hydration_logs enable row level security;
do $$ begin
  create policy "hydration_logs_own" on hydration_logs for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
create index if not exists hydration_logs_idx on hydration_logs(user_id, patient_id, at);
