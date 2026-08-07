-- sprint125_patient_photo.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: PRECISAS DE CORRER ISTO TU MESMO NO SUPABASE (SQL EDITOR).
-- Não apliquei — não toco no Supabase sem pedires (ver memória do projeto).
--
-- Adiciona upload de foto de perfil ao utente (modal "Editar"/"+ Novo utente"
-- em /patients), pedido na auditoria. Precisa de duas coisas:
--
-- 1) coluna `photo_url` em patients — o código já está pronto a usá-la.
-- 2) um bucket de Storage novo ("patient-photos") + as políticas de RLS de
--    storage.objects que permitem enviar/ver/apagar ficheiros lá. Sem as
--    políticas, criar o bucket sozinho no painel do Supabase NÃO chega — o
--    upload falha com "permission denied" (já aconteceu antes com o bucket
--    "skin-lesions", ver sprint116_skin_lesions_bucket.sql).
--
-- DECISÃO DE DESIGN: ao contrário do bucket "documents" (privado, URLs
-- assinadas, pasta por UTILIZADOR que fez upload — ${user.id}/...), este é
-- PÚBLICO como "wounds"/"skin-lesions" (fotos clínicas já usam este padrão) e
-- a pasta é por UTENTE (${patient_id}/...), não por quem fez o upload —
-- porque a foto de um utente é vista e substituída por QUALQUER pessoa da
-- equipa, não só por quem a tirou primeiro. Quem pode gerir um utente já é
-- controlado pela RLS da tabela `patients`; ao nível do storage basta exigir
-- sessão autenticada.
-- ─────────────────────────────────────────────────────────────────────────────

alter table patients add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('patient-photos', 'patient-photos', true)
on conflict (id) do update set public = true;

do $$ begin
  create policy "patient_photos_upload_authenticated" on storage.objects for insert
    to authenticated
    with check (bucket_id = 'patient-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "patient_photos_update_authenticated" on storage.objects for update
    to authenticated
    using (bucket_id = 'patient-photos')
    with check (bucket_id = 'patient-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "patient_photos_delete_authenticated" on storage.objects for delete
    to authenticated
    using (bucket_id = 'patient-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "patient_photos_read_public" on storage.objects for select
    using (bucket_id = 'patient-photos');
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
