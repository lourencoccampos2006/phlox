-- Sprint 10: Drug Intelligence, Quality, Team tables
-- Run in Supabase SQL Editor

-- ── Formulary ────────────────────────────────────────────────────────────────
create table if not exists formulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  generic text,
  class text,
  atc text,
  form text,
  strength text,
  status text default 'approved' check (status in ('approved','restricted','non_formulary','under_review')),
  restricted_to text,
  alternatives text[] default '{}',
  unit_cost numeric,
  monthly_usage integer,
  stock_days integer,
  ddd_per_100 numeric,
  last_reviewed date,
  created_at timestamptz default now()
);

alter table formulary enable row level security;
create policy "formulary_own" on formulary for all using (user_id = auth.uid());

-- ── Drug Shortages ───────────────────────────────────────────────────────────
create table if not exists drug_shortages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  drug text not null,
  generic text,
  severity text default 'moderate' check (severity in ('critical','severe','moderate','resolved')),
  since date,
  expected_resolution date,
  reason text,
  alternatives text[] default '{}',
  affected_units text[] default '{}',
  notes text,
  created_at timestamptz default now()
);

alter table drug_shortages enable row level security;
create policy "shortages_own" on drug_shortages for all using (user_id = auth.uid());

-- ── Safety Events ────────────────────────────────────────────────────────────
create table if not exists safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  date date not null default current_date,
  type text,
  severity text,
  unit text,
  description text,
  drug text,
  status text default 'open' check (status in ('open','under_review','closed')),
  harm boolean default false,
  created_at timestamptz default now()
);

alter table safety_events enable row level security;
create policy "events_own" on safety_events for all using (user_id = auth.uid());

-- ── Pharmacist Interventions ──────────────────────────────────────────────────
create table if not exists pharma_interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text,
  count integer default 1,
  accepted integer default 1,
  value_eur numeric default 0,
  date date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

alter table pharma_interventions enable row level security;
create policy "interventions_own" on pharma_interventions for all using (user_id = auth.uid());

-- ── Team Members ──────────────────────────────────────────────────────────────
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  role text,
  unit text,
  phone text,
  shift text default 'morning' check (shift in ('morning','afternoon','night','off')),
  shift_start text,
  shift_end text,
  on_call boolean default false,
  status text default 'off' check (status in ('on_shift','break','off','sick','vacation')),
  vacation_days integer default 22,
  competencies jsonb default '{}',
  next_training text,
  tasks_done integer default 0,
  tasks_total integer default 0,
  created_at timestamptz default now()
);

alter table team_members enable row level security;
create policy "team_own" on team_members for all using (user_id = auth.uid());

-- ── Training Sessions ─────────────────────────────────────────────────────────
create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  category text,
  date date,
  seats_total integer default 10,
  seats_taken integer default 0,
  mandatory boolean default false,
  enrolled_names text[] default '{}',
  created_at timestamptz default now()
);

alter table training_sessions enable row level security;
create policy "trainings_own" on training_sessions for all using (user_id = auth.uid());

-- ── Shift Vacancies ───────────────────────────────────────────────────────────
create table if not exists shift_vacancies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  shift text,
  date date,
  unit text,
  role text,
  urgency text default 'normal' check (urgency in ('critical','urgent','normal')),
  covered_by text,
  created_at timestamptz default now()
);

alter table shift_vacancies enable row level security;
create policy "vacancies_own" on shift_vacancies for all using (user_id = auth.uid());
