-- sprint115_share_notify.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- MELHORIA 2026-07-21 (sugestão nº5 da auditoria) — "notificar o viewer quando
-- o perfil partilhado muda". O convite de visualização (sprint112) já dá acesso
-- de leitura, mas quem vê só sabia de uma alteração se abrisse a app. Esta
-- coluna guarda quando o viewer foi avisado pela última vez, para o cron de
-- push (app/api/push/cron/route.ts) só notificar sobre alterações NOVAS desde
-- então (nunca sobre o histórico inteiro do perfil).
-- ─────────────────────────────────────────────────────────────────────────────

alter table family_profile_shares
  add column if not exists last_activity_notified_at timestamptz;
