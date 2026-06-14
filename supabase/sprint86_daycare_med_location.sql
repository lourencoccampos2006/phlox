-- Sprint 86 — Centro de Dia: ponte de medicação casa ↔ centro
-- Correr no SQL Editor do Supabase.
--
-- O diferenciador do centro de dia: o utente toma UMAS tomas no centro e OUTRAS
-- em casa. Esta coluna marca, por medicamento, onde é dado — para a equipa saber
-- exatamente do que é responsável e a família ver o que tem de dar em casa.
--   'centro' = dado no centro de dia
--   'casa'   = a família dá em casa
--   'ambos'  = tomas em ambos os sítios (ex: manhã em casa, almoço no centro)

alter table patient_meds
  add column if not exists take_location text
  check (take_location in ('centro', 'casa', 'ambos'))
  default 'centro';

-- Índice leve para filtrar a medicação do dia por local.
create index if not exists patient_meds_take_location_idx
  on patient_meds (patient_id, take_location);
