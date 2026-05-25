-- Sprint 19: Agenda Clínica & Transportes
-- Run in Supabase SQL Editor

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,  -- null = evento do lar
  title text not null,
  type text not null default 'consulta'
    check (type in ('consulta','exame','terapia','visita_medica','transporte','reuniao','vacina','outro')),
  date date not null,
  time text,
  end_time text,
  location text,
  speciality text,
  transport boolean default false,
  transport_notes text,
  responsible text,
  status text not null default 'scheduled' check (status in ('scheduled','done','cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table appointments enable row level security;
do $$ begin
  create policy "appointments_own" on appointments for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
create index if not exists appointments_user_date_idx on appointments(user_id, date);
create index if not exists appointments_patient_idx on appointments(patient_id);
