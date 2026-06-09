-- sprint83_vigilancia_noturna.sql
-- Phlox — Vigilância noturna automática. Guarda o risco ANTERIOR para detetar
-- residentes que pioraram desde a última varredura.
-- 2026-06-07. Idempotente.

alter table patient_vigilance add column if not exists prev_risk_score int default 0;
alter table patient_vigilance add column if not exists auto_scanned_at timestamptz;
