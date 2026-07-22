-- COLAR_NO_SQL_EDITOR_2026_07_21.sql
-- Migrações pendentes. Não apagam nem alteram nada que já exista. Cola tudo
-- isto no SQL Editor do Supabase (o teu projeto → menu lateral "SQL Editor" →
-- "New query" → colar → "Run") e é feito num clique, poucos segundos.

-- sprint115_share_notify.sql — permite ao cron de push saber quando já avisou
-- o viewer de um perfil partilhado, para só notificar sobre alterações NOVAS.
alter table family_profile_shares
  add column if not exists last_activity_notified_at timestamptz;

-- sprint116_skin_lesions_bucket.sql — CORRIGE O /rastreio-visual. Criar um
-- bucket à mão no painel do Supabase só cria a entrada em storage.buckets —
-- não cria as políticas de RLS em storage.objects que deixam um utilizador
-- autenticado enviar/ler/apagar ficheiros lá. Sem isto, o upload falha com
-- "permission denied" (não "bucket not found", apesar da mensagem de erro
-- antiga sugerir isso). Idempotente — corre bem mesmo já tendo criado o
-- bucket à mão (garante só que fica público e que as 3 políticas existem).
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

-- sprint117_condition_tracking_mode.sql — NOVO: o /rastreio-visual ganha um
-- 2º modo, "acompanhar doença diagnosticada" (mais calmo, sem alarme a cada
-- foto), ao lado do rastreio de risco original. Só acrescenta 2 colunas à
-- track (mode, condition_name) — as fotos reaproveitam colunas existentes.
alter table skin_lesion_tracks
  add column if not exists mode text not null default 'screening',
  add column if not exists condition_name text;

do $$ begin
  alter table skin_lesion_tracks add constraint skin_lesion_tracks_mode_check check (mode in ('screening', 'condition'));
exception when duplicate_object then null; end $$;
