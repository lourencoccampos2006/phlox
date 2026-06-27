-- sprint92_med_sync.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- PONTE DE MEDICAÇÃO CASA ↔ CENTRO (sincronização nos dois sentidos)
--
-- Centro de dia: o utente toma umas tomas no centro e outras em casa. Queremos
-- que, quando a FAMÍLIA marca uma toma de casa (no portal/app), essa toma apareça
-- no /mar e no painel da instituição; e que o que o CENTRO regista no /mar fique
-- visível à família. Os dois lados escrevem na MESMA tabela (mar_records) — basta
-- saber QUEM/ONDE registou.
--
-- 2026-06-26.
-- ─────────────────────────────────────────────────────────────────────────────

-- Onde/quem deu a toma: 'centro' (equipa) | 'home' (família em casa).
-- Default 'centro' para não afetar registos existentes.
alter table mar_records
  add column if not exists source text
  check (source in ('centro', 'home'))
  default 'centro';

-- Nome legível de quem deu em casa (ex.: "Mãe", "Filha") — opcional.
alter table mar_records
  add column if not exists home_by text;

create index if not exists mar_records_source_idx on mar_records (patient_id, date, source);
