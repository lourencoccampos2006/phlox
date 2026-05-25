-- Sprint 22: Faturação & Mensalidades (gestão financeira ERPI)
-- Run in Supabase SQL Editor

create table if not exists billing_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  month text not null,                 -- YYYY-MM
  fee numeric not null default 0,       -- mensalidade
  subsidy numeric not null default 0,   -- comparticipação (Segurança Social / acordo)
  extras numeric not null default 0,    -- extras (fraldas, transporte, etc.)
  discount numeric not null default 0,
  paid boolean not null default false,
  paid_date date,
  method text,                          -- transferência | débito | numerário | cheque
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, patient_id, month)
);
alter table billing_entries enable row level security;
do $$ begin
  create policy "billing_entries_own" on billing_entries for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
create index if not exists billing_entries_idx on billing_entries(user_id, month);
