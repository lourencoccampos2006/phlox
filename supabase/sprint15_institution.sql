-- Sprint 15: Perfil e personalização da Instituição (plano clínico)
-- Run in Supabase SQL Editor

create table if not exists institution_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  name text,                 -- "Lar São José", "Hospital de Évora"
  short_name text,           -- "São José"
  type text,                 -- nursing_home | hospital | pharmacy_hospital | pharmacy_community | clinic | health_center
  logo_url text,
  accent_color text default '#0d6e42',
  address text,
  phone text,
  email text,
  director text,             -- diretor(a) técnico(a) / responsável
  nif text,
  total_beds int,
  shift_manha_start text default '07:00', shift_manha_end text default '14:00',
  shift_tarde_start text default '14:00', shift_tarde_end text default '21:00',
  shift_noite_start text default '21:00', shift_noite_end text default '07:00',
  protocols jsonb default '[]'::jsonb,
  enabled_tools text[],      -- ferramentas extra que o user escolheu mostrar (override do onboarding)
  updated_at timestamptz default now()
);
alter table institution_settings enable row level security;
do $$ begin
  create policy "institution_settings_own" on institution_settings for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
