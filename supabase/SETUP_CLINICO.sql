-- ════════════════════════════════════════════════════════════════════════════
--  PHLOX — SETUP COMPLETO DO PLANO CLÍNICO (Lar / ERPI)
--  Corre este ficheiro UMA vez no SQL Editor do Supabase. É idempotente
--  (podes correr várias vezes sem problema). Inclui sprints 13–21.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Colunas extra em patients (sprint13) ─────────────────────────────────────
alter table patients add column if not exists room_number text;
alter table patients add column if not exists admission_date date;
alter table patients add column if not exists discharge_date date;
alter table patients add column if not exists date_of_birth date;
alter table patients add column if not exists emergency_contact text;
alter table patients add column if not exists emergency_phone text;
alter table patients add column if not exists diagnosis text;
alter table patients add column if not exists fall_risk text;
alter table patients add column if not exists pressure_risk text;
alter table patients add column if not exists risk_level text;
alter table patients add column if not exists alert_count int;
alter table patients add column if not exists last_review timestamptz;
alter table patients add column if not exists height numeric;
alter table patients add column if not exists active boolean default true;
create index if not exists patients_room_idx on patients(user_id, room_number);

-- ── Onboarding / perfil (sprint17) ───────────────────────────────────────────
alter table profiles add column if not exists institution_type text;
alter table profiles add column if not exists professional_role text;
alter table profiles add column if not exists student_area text;
alter table profiles add column if not exists student_year text;
alter table profiles add column if not exists onboarding_answers jsonb;

-- ── Helper: cria política só se não existir ──────────────────────────────────
-- (usado em todas as tabelas abaixo)

-- ── team_members ─────────────────────────────────────────────────────────────
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  name text not null, role text not null default 'nurse', phone text, status text default 'active', created_at timestamptz default now()
);
alter table team_members enable row level security;
do $$ begin create policy "team_members_own" on team_members for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── shift_assignments ────────────────────────────────────────────────────────
create table if not exists shift_assignments (
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  team_member_id uuid, date date not null, shift text not null, notes text, created_at timestamptz default now()
);
alter table shift_assignments enable row level security;
do $$ begin create policy "shift_assignments_own" on shift_assignments for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── institution_settings (sprint15) ──────────────────────────────────────────
create table if not exists institution_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  name text, short_name text, type text, logo_url text, accent_color text default '#0d6e42',
  address text, phone text, email text, director text, nif text, total_beds int,
  shift_manha_start text default '07:00', shift_manha_end text default '14:00',
  shift_tarde_start text default '14:00', shift_tarde_end text default '21:00',
  shift_noite_start text default '21:00', shift_noite_end text default '07:00',
  protocols jsonb default '[]'::jsonb, enabled_tools text[], updated_at timestamptz default now()
);
alter table institution_settings enable row level security;
do $$ begin create policy "institution_settings_own" on institution_settings for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── wounds + wound_assessments (sprint14 + 18) ───────────────────────────────
create table if not exists wounds (
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade, location text not null, type text not null default 'pressure',
  stage text, status text not null default 'active', onset_date date, healed_date date,
  length_mm numeric, width_mm numeric, depth_mm numeric, exudate text, tissue text, infection_signs boolean default false,
  dressing text, treatment text, notes text, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table wounds enable row level security;
do $$ begin create policy "wounds_own" on wounds for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
create table if not exists wound_assessments (
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  wound_id uuid references wounds(id) on delete cascade, date date not null default current_date,
  length_mm numeric, width_mm numeric, depth_mm numeric, stage text, exudate text, tissue text, pain int,
  dressing text, notes text, assessed_by text, photo_url text, created_at timestamptz default now()
);
alter table wound_assessments enable row level security;
do $$ begin create policy "wound_assessments_own" on wound_assessments for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── protocols (sprint16) ─────────────────────────────────────────────────────
create table if not exists protocols (
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  title text not null, category text not null default 'other', description text,
  steps jsonb not null default '[]'::jsonb, active boolean not null default true, review_date date,
  updated_at timestamptz default now(), created_at timestamptz default now()
);
alter table protocols enable row level security;
do $$ begin create policy "protocols_own" on protocols for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── appointments (sprint19) ──────────────────────────────────────────────────
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null, title text not null, type text not null default 'consulta',
  date date not null, time text, end_time text, location text, speciality text,
  transport boolean default false, transport_notes text, responsible text, status text not null default 'scheduled',
  notes text, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table appointments enable row level security;
do $$ begin create policy "appointments_own" on appointments for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── hydration_logs (sprint20) ────────────────────────────────────────────────
create table if not exists hydration_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade, at timestamptz not null default now(),
  kind text not null, fluid_ml int, bristol int, urine text, notes text, recorded_by text, created_at timestamptz default now()
);
alter table hydration_logs enable row level security;
do $$ begin create policy "hydration_logs_own" on hydration_logs for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── stock_items (sprint21) ───────────────────────────────────────────────────
create table if not exists stock_items (
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  name text not null, category text default 'medicamento', quantity numeric not null default 0, unit text default 'un',
  min_quantity numeric default 0, expiry_date date, location text, notes text,
  updated_at timestamptz default now(), created_at timestamptz default now()
);
alter table stock_items enable row level security;
do $$ begin create policy "stock_items_own" on stock_items for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── Storage: bucket de fotos de feridas ──────────────────────────────────────
insert into storage.buckets (id, name, public) values ('wounds', 'wounds', true) on conflict (id) do nothing;
do $$ begin create policy "wounds_upload_own" on storage.objects for insert with check (bucket_id = 'wounds' and (storage.foldername(name))[1] = auth.uid()::text); exception when duplicate_object then null; end $$;
do $$ begin create policy "wounds_read_public" on storage.objects for select using (bucket_id = 'wounds'); exception when duplicate_object then null; end $$;

-- ── Realtime (atualizações ao vivo) — adiciona as tabelas à publicação ───────
do $$ begin alter publication supabase_realtime add table mar_records; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table care_records; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table incidents; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table wounds; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table appointments; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table hydration_logs; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table stock_items; exception when others then null; end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  FIM. O plano clínico está pronto. (Define também GEMINI_API_KEY no ambiente
--  para a análise de fotos de feridas por IA.)
-- ════════════════════════════════════════════════════════════════════════════
