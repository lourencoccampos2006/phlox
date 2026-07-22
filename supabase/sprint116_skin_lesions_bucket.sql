-- sprint116_skin_lesions_bucket.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Corrige o /rastreio-visual: o bucket "skin-lesions" foi criado à mão no
-- painel do Supabase (Storage → New bucket), mas isso só cria a entrada em
-- storage.buckets — NÃO cria as políticas de RLS em storage.objects que
-- permitem a um utilizador autenticado enviar/ler/apagar ficheiros lá dentro.
-- Sem essas políticas, o upload falha com "permission denied", e o catch
-- genérico em app/api/lesion-track/route.ts mostra sempre a mesma mensagem
-- ("cria o bucket") mesmo quando o bucket já existe — daí a confusão.
--
-- Mesmo padrão já usado para o bucket "wounds" (sprint18_wound_photos.sql):
-- bucket público (para as fotos serem visíveis por URL) + 3 políticas
-- (upload/leitura/apagar), cada uma restrita à própria pasta do utilizador
-- (o caminho gerado no código é `${userId}/${trackId}/...`).
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('skin-lesions', 'skin-lesions', true)
on conflict (id) do update set public = true;

do $$ begin
  create policy "skin_lesions_upload_own" on storage.objects for insert
    with check (bucket_id = 'skin-lesions' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "skin_lesions_read_public" on storage.objects for select
    using (bucket_id = 'skin-lesions');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "skin_lesions_delete_own" on storage.objects for delete
    using (bucket_id = 'skin-lesions' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
