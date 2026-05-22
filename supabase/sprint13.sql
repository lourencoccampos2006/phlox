-- Sprint 13: Add nursing home patient fields + fix assessments column reference
-- Run in Supabase SQL Editor

-- ── Add missing columns to patients table ────────────────────────────────────
alter table patients add column if not exists room_number text;
alter table patients add column if not exists admission_date date;
alter table patients add column if not exists discharge_date date;
alter table patients add column if not exists discharge_reason text;
alter table patients add column if not exists date_of_birth date;
alter table patients add column if not exists emergency_contact text;
alter table patients add column if not exists emergency_phone text;
alter table patients add column if not exists doctor text;
alter table patients add column if not exists insurance text;
alter table patients add column if not exists diagnosis text;
alter table patients add column if not exists diet text;
alter table patients add column if not exists mobility text;
alter table patients add column if not exists fall_risk text check (fall_risk in ('low','medium','high'));
alter table patients add column if not exists pressure_risk text check (pressure_risk in ('low','medium','high'));
alter table patients add column if not exists cognitive_status text;

-- ── Index for room queries ───────────────────────────────────────────────────
create index if not exists patients_room_idx on patients(user_id, room_number);

-- ── Fix assessments column: add 'scale' alias view if needed ─────────────────
-- The assessments table already uses 'scale' column (sprint11).
-- This is just to document: code must use 'scale', not 'type'.

-- ── Add team_members table if not exists ─────────────────────────────────────
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  role text not null default 'nurse',
  phone text,
  email text,
  status text not null default 'active' check (status in ('active','inactive','vacation','sick')),
  shift_preference text,
  hire_date date,
  notes text,
  created_at timestamptz default now()
);
alter table team_members enable row level security;
create policy "team_members_own" on team_members for all using (user_id = auth.uid());
create index if not exists team_members_user_idx on team_members(user_id, status);

-- ── quality_records table ─────────────────────────────────────────────────────
create table if not exists quality_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  month text not null,       -- YYYY-MM
  indicator text not null,
  value numeric,
  target numeric,
  notes text,
  category text default 'clinical',
  created_at timestamptz default now(),
  unique (user_id, month, indicator)
);
alter table quality_records enable row level security;
create policy "quality_records_own" on quality_records for all using (user_id = auth.uid());
