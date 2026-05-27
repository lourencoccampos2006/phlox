-- Sprint 28: Diário de Sintomas (modo pessoal/familiar)
-- Registo diário rápido de bem-estar/sintomas, por perfil (próprio ou familiar).
-- Run in Supabase SQL Editor.

create table if not exists symptom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  profile_id uuid references family_profiles(id) on delete cascade,  -- null = próprio
  at timestamptz not null default now(),
  feeling int,            -- 1 (muito mal) .. 5 (ótimo)
  symptoms text[],        -- ex: {"dor de cabeça","febre"}
  pain int,               -- 0..10
  temperature numeric,    -- °C, opcional
  notes text,
  created_at timestamptz default now()
);
alter table symptom_logs enable row level security;
do $$ begin
  create policy "symptom_logs_own" on symptom_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists symptom_logs_idx on symptom_logs(user_id, profile_id, at desc);
