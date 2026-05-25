-- Sprint 16: Protocolos personalizáveis da instituição (plano clínico)
-- Run in Supabase SQL Editor

create table if not exists protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  category text not null default 'other'
    check (category in ('fall','pressure_ulcer','emergency','admission','infection','restraint','medication','end_of_life','nutrition','other')),
  description text,
  steps jsonb not null default '[]'::jsonb,   -- [{ "text": "...", "critical": false }]
  active boolean not null default true,
  review_date date,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table protocols enable row level security;
do $$ begin
  create policy "protocols_own" on protocols for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
create index if not exists protocols_user_idx on protocols(user_id, category, active);
