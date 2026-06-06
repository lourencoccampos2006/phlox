-- sprint81_patient_detail.sql
-- Phlox — Ficha do doente mais completa: objetivos por doente.
-- (Procedimentos por doente já existem via internship_procedures.patient_id;
--  medicação via internship_patients.current_meds.)
--
-- 2026-06-05. Idempotente.

alter table internship_patients add column if not exists goals text;
  -- objetivos de aprendizagem/seguimento específicos DESTE doente
