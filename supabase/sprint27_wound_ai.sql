-- Sprint 27: Guardar o relatório da análise IA na avaliação de ferida
-- Permite analisar a foto DEPOIS de submeter e manter o relatório no histórico.
-- Run in Supabase SQL Editor.

alter table wound_assessments add column if not exists ai_report jsonb;
