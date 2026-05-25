-- Sprint 18: Fotos de feridas (documentação fotográfica da evolução)
-- Run in Supabase SQL Editor

alter table wound_assessments add column if not exists photo_url text;

-- ── Storage bucket para fotos de feridas ─────────────────────────────────────
-- Cria o bucket (público) e políticas de acesso por utilizador.
insert into storage.buckets (id, name, public)
values ('wounds', 'wounds', true)
on conflict (id) do nothing;

do $$ begin
  create policy "wounds_upload_own" on storage.objects for insert
    with check (bucket_id = 'wounds' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "wounds_read_public" on storage.objects for select
    using (bucket_id = 'wounds');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "wounds_delete_own" on storage.objects for delete
    using (bucket_id = 'wounds' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
