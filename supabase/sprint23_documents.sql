-- Sprint 23: Gestão Documental (processo do residente / instituição)
-- Run in Supabase SQL Editor

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,  -- null = documento da instituição
  name text not null,
  category text not null default 'outro'
    check (category in ('contrato','consentimento','identificacao','medico','seguro','rgpd','financeiro','outro')),
  file_path text not null,     -- caminho no bucket privado 'documents'
  expiry_date date,
  notes text,
  created_at timestamptz default now()
);
alter table documents enable row level security;
do $$ begin
  create policy "documents_own" on documents for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
create index if not exists documents_idx on documents(user_id, patient_id);

-- ── Storage bucket PRIVADO (documentos sensíveis → URLs assinadas) ───────────
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
do $$ begin
  create policy "documents_rw_own" on storage.objects for all
    using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
