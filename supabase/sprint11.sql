-- Sprint 11: Nursing Home — assessments, care_records, incidents, care_plans, resident_contacts
-- Run in Supabase SQL Editor

-- ── Assessments (Barthel, Braden, Morse, MMSE, MNA, Lawton, GDS) ─────────────
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  scale text not null check (scale in ('barthel','braden','morse','mmse','mna','lawton','gds','norton')),
  score numeric not null,
  level text,
  answers jsonb default '{}',
  notes text,
  evaluated_by text,
  date date not null default current_date,
  created_at timestamptz default now()
);

alter table assessments enable row level security;
create policy "assessments_own" on assessments for all using (user_id = auth.uid());
create index if not exists assessments_patient_idx on assessments(patient_id, date desc);

-- ── Care Records (daily nursing records per shift) ────────────────────────────
create table if not exists care_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  date date not null default current_date,
  shift text not null check (shift in ('manha','tarde','noite')),
  vitals jsonb default '{}',       -- bp_sys, bp_dia, hr, temp, spo2, glucose, weight
  nutrition jsonb default '{}',    -- breakfast, lunch, dinner, snacks (0-100%), fluid_ml, appetite
  continence jsonb default '{}',   -- urinary, bowel
  mood jsonb default '{}',         -- level (1-5), activities, behavior
  skin jsonb default '{}',         -- integrity, description
  notes text,
  recorded_by text,
  created_at timestamptz default now(),
  unique (patient_id, date, shift)
);

alter table care_records enable row level security;
create policy "care_records_own" on care_records for all using (user_id = auth.uid());
create index if not exists care_records_patient_date_idx on care_records(patient_id, date desc);

-- ── Incidents (falls, medication errors, pressure ulcers, behavioral) ─────────
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  date date not null default current_date,
  time text,
  type text not null check (type in ('fall','medication_error','pressure_ulcer','behavioral','choking','infection','other')),
  severity text not null check (severity in ('minor','moderate','major','critical')) default 'minor',
  location text,
  description text not null,
  witnesses text,
  injuries text,
  action_taken text,
  reported_to text,
  reported_at timestamptz,
  outcome text,
  follow_up_required boolean default false,
  follow_up_notes text,
  root_cause text,
  status text default 'open' check (status in ('open','under_review','closed')),
  created_by text,
  created_at timestamptz default now()
);

alter table incidents enable row level security;
create policy "incidents_own" on incidents for all using (user_id = auth.uid());
create index if not exists incidents_patient_idx on incidents(patient_id, date desc);
create index if not exists incidents_date_idx on incidents(user_id, date desc);

-- ── Care Plans (per resident) ─────────────────────────────────────────────────
create table if not exists care_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade unique,
  last_updated date default current_date,
  mobility text,
  hygiene text,
  nutrition_plan text,
  skin_care text,
  fall_prevention text[] default '{}',
  pressure_ulcer_prevention text[] default '{}',
  medication_notes text,
  behavioral_notes text,
  family_visit_schedule text,
  goals text[] default '{}',
  diet_type text,
  diet_texture text,
  fluid_restriction boolean default false,
  fluid_restriction_ml integer,
  positioning_schedule text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table care_plans enable row level security;
create policy "care_plans_own" on care_plans for all using (user_id = auth.uid());

-- ── Resident Contacts (family, emergency, legal guardian) ─────────────────────
create table if not exists resident_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  email text,
  is_emergency boolean default true,
  is_legal_guardian boolean default false,
  can_visit boolean default true,
  notes text,
  created_at timestamptz default now()
);

alter table resident_contacts enable row level security;
create policy "contacts_own" on resident_contacts for all using (user_id = auth.uid());
create index if not exists contacts_patient_idx on resident_contacts(patient_id);

-- ── Handover Notes (per shift) ────────────────────────────────────────────────
create table if not exists handover_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  date date not null default current_date,
  shift text not null check (shift in ('manha','tarde','noite')),
  notes text,
  pending_tasks text[] default '{}',
  signed_by text,
  signed_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, date, shift)
);

alter table handover_notes enable row level security;
create policy "handover_notes_own" on handover_notes for all using (user_id = auth.uid());
