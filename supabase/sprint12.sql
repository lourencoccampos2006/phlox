-- Sprint 12: scheduling, activities, family portal

-- Shift assignments for /schedule
create table if not exists shift_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  team_member_id uuid references team_members(id) on delete cascade,
  date date not null,
  shift text not null check (shift in ('manha','tarde','noite')),
  notes text,
  created_at timestamptz default now()
);
alter table shift_assignments enable row level security;
create policy "shift_assignments_own" on shift_assignments
  for all using (user_id = auth.uid());

-- Activities for /activities
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  type text not null default 'other',
  date date not null,
  start_time text not null,
  end_time text,
  location text,
  responsible text,
  description text,
  max_participants int,
  status text not null default 'planned' check (status in ('planned','ongoing','done','cancelled')),
  created_at timestamptz default now()
);
alter table activities enable row level security;
create policy "activities_own" on activities
  for all using (user_id = auth.uid());

-- Activity participations
create table if not exists activity_participations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  activity_id uuid references activities(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  attended boolean not null default false,
  notes text,
  created_at timestamptz default now(),
  unique(activity_id, patient_id)
);
alter table activity_participations enable row level security;
create policy "activity_participations_own" on activity_participations
  for all using (user_id = auth.uid());

-- Family messages for /family
create table if not exists family_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  contact_id uuid,
  subject text not null,
  body text not null,
  type text not null default 'general' check (type in ('update','alert','visit','report','general')),
  direction text not null default 'sent' check (direction in ('sent','received')),
  read boolean not null default true,
  created_at timestamptz default now()
);
alter table family_messages enable row level security;
create policy "family_messages_own" on family_messages
  for all using (user_id = auth.uid());

-- Visit requests for /family
create table if not exists visit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  contact_id uuid,
  requested_date date not null,
  requested_time text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','declined','completed')),
  created_at timestamptz default now()
);
alter table visit_requests enable row level security;
create policy "visit_requests_own" on visit_requests
  for all using (user_id = auth.uid());
