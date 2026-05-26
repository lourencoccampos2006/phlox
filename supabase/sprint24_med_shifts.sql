-- Sprint 24: Horário de toma por turno em patient_meds
-- Permite que o MAR saiba que medicação é devida em CADA turno (manhã/tarde/noite),
-- eliminando "omissões" falsas. Vazio/null = devido em todos os turnos (compat. retro).
-- Run in Supabase SQL Editor.

alter table patient_meds add column if not exists shifts text[];
-- ex: ['manha'] · ['manha','noite'] · null = todos os turnos
