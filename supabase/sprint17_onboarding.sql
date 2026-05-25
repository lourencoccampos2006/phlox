-- Sprint 17: Onboarding estruturado — respostas guardadas para adaptar a plataforma
-- Run in Supabase SQL Editor

alter table profiles add column if not exists institution_type text;   -- nursing_home | hospital | clinic | pharmacy_hospital | pharmacy_community | health_center
alter table profiles add column if not exists professional_role text;  -- nurse | pharmacist | doctor | coordinator | director | caregiver | admin
alter table profiles add column if not exists student_area text;       -- medicine | dentistry | pharmacy | nursing | ...
alter table profiles add column if not exists student_year text;
alter table profiles add column if not exists onboarding_answers jsonb;
-- (profiles já tem: experience_mode, profile_type, profile_sub, onboarded)
