-- Sprint 14: Gestão de Feridas / Úlceras de Pressão
-- Run in Supabase SQL Editor

-- ── Feridas (registo principal) ──────────────────────────────────────────────
create table if not exists wounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  location text not null,                       -- sacro, calcâneo D/E, trocânter, etc.
  type text not null default 'pressure'         -- pressure | venous | arterial | diabetic | surgical | skin_tear | other
    check (type in ('pressure','venous','arterial','diabetic','surgical','skin_tear','other')),
  stage text,                                    -- I | II | III | IV | unstageable | DTI
  status text not null default 'active'          -- active | healing | healed
    check (status in ('active','healing','healed')),
  onset_date date,
  healed_date date,
  length_mm numeric, width_mm numeric, depth_mm numeric,
  exudate text, tissue text,
  infection_signs boolean default false,
  dressing text, treatment text, notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table wounds enable row level security;
do $$ begin
  create policy "wounds_own" on wounds for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
create index if not exists wounds_user_idx on wounds(user_id, status);
create index if not exists wounds_patient_idx on wounds(patient_id);

-- ── Avaliações de ferida (evolução ao longo do tempo) ────────────────────────
create table if not exists wound_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  wound_id uuid references wounds(id) on delete cascade,
  date date not null default current_date,
  length_mm numeric, width_mm numeric, depth_mm numeric,
  stage text, exudate text, tissue text,
  pain int,                                      -- 0-10
  dressing text, notes text, assessed_by text,
  created_at timestamptz default now()
);
alter table wound_assessments enable row level security;
do $$ begin
  create policy "wound_assessments_own" on wound_assessments for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
create index if not exists wound_assessments_wound_idx on wound_assessments(wound_id, date);
