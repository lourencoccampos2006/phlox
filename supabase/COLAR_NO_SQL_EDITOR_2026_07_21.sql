-- COLAR_NO_SQL_EDITOR_2026_07_21.sql
-- Migração pendente desta ronda (2026-07-21). Só cria uma coluna nova — não
-- apaga nem altera nada que já exista. Cola tudo isto no SQL Editor do
-- Supabase (o teu projeto → menu lateral "SQL Editor" → "New query" → colar →
-- "Run") e é feito num clique, ~2 segundos.

-- sprint115_share_notify.sql — permite ao cron de push saber quando já avisou
-- o viewer de um perfil partilhado, para só notificar sobre alterações NOVAS.
alter table family_profile_shares
  add column if not exists last_activity_notified_at timestamptz;
