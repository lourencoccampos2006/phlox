-- Sprint 25: Phlox Família — fio de conversa lar ↔ família por residente
-- Comunicação estruturada e auditável que substitui o WhatsApp para famílias de residentes.
-- Run in Supabase SQL Editor.

create table if not exists family_thread_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,   -- dono (a instituição/lar)
  patient_id uuid references patients(id) on delete cascade, -- residente a que o fio diz respeito
  author_side text not null default 'staff' check (author_side in ('staff','family')),
  author_name text,                 -- quem escreveu (colaborador ou familiar)
  contact_id uuid,                  -- resident_contacts.id quando author_side='family'
  kind text not null default 'message'
    check (kind in ('message','update','wellbeing','photo','milestone','system')),
  content text,                     -- texto livre
  photo_url text,                   -- foto (bucket público 'family')
  -- boletim de bem-estar estruturado (kind='wellbeing'):
  mood text,                        -- bom | razoavel | mau
  meals text,                       -- tudo | parte | pouco
  activity text,                    -- ativo | calmo | na_cama
  metadata jsonb,                   -- extensível
  read_by_family boolean default false,
  read_by_staff boolean default true,
  created_at timestamptz default now()
);
alter table family_thread_messages enable row level security;
do $$ begin
  create policy "family_thread_own" on family_thread_messages for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
create index if not exists family_thread_idx on family_thread_messages(user_id, patient_id, created_at);

-- Realtime
do $$ begin alter publication supabase_realtime add table family_thread_messages; exception when others then null; end $$;

-- Bucket público para fotos partilhadas com a família
insert into storage.buckets (id, name, public) values ('family', 'family', true) on conflict (id) do nothing;
do $$ begin
  create policy "family_upload_own" on storage.objects for insert
    with check (bucket_id = 'family' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "family_read_public" on storage.objects for select using (bucket_id = 'family');
exception when duplicate_object then null; end $$;
