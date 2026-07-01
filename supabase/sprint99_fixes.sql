-- sprint99_fixes.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda 9 — correções pontuais reportadas.
--
-- BUG: pedidos de visita da família falhavam em silêncio quando a família não
-- escolhia hora — `visit_requests.requested_time` era NOT NULL (sprint12), e a
-- API já tinha a escrever null nesse caso. A API foi corrigida para nunca
-- mandar null (usa string vazia), mas relaxamos a coluna na mesma para o caso
-- ficar corretamente opcional a nível de esquema.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists visit_requests alter column requested_time drop not null;
