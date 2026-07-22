-- sprint117_condition_tracking_mode.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Pedido 2026-07-22: o /rastreio-visual (sprint102) foi desenhado só para
-- RASTREIO DE RISCO (ABCDE de melanoma, tom conservador/alarmista de propósito
-- — "quando em dúvida, assinala"). Fernando tem uma condição JÁ DIAGNOSTICADA
-- (hidradenite supurativa) e só quer ACOMPANHAR PROGRESSÃO com calma —
-- relatórios claros, sem "vai já ao médico" a cada foto. É um modo diferente,
-- não o mesmo rastreio com tom mais brando.
--
-- Reaproveita as tabelas existentes (não duplica): uma track ganha um `mode`
-- ('screening' = comportamento antigo, por omissão; 'condition' = novo) e um
-- nome da condição. As fotos não precisam de colunas novas — o jsonb `abcde`
-- já guarda campos livres; em modo 'condition' guarda {description, trend,
-- trend_note, doctor_flag, doctor_reason} em vez dos campos ABCDE. risk_score/
-- risk_level continuam a ser preenchidos (mapeados a partir de trend/
-- doctor_flag) para a badge da lista funcionar igual nos dois modos.
-- ─────────────────────────────────────────────────────────────────────────────

alter table skin_lesion_tracks
  add column if not exists mode text not null default 'screening',
  add column if not exists condition_name text;

do $$ begin
  alter table skin_lesion_tracks add constraint skin_lesion_tracks_mode_check check (mode in ('screening', 'condition'));
exception when duplicate_object then null; end $$;
