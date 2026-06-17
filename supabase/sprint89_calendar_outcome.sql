-- sprint89_calendar_outcome.sql
-- Calendário inteligente: follow-up "como correu?" depois de um evento passar.
-- Guardamos o desfecho no próprio evento. Tolerante a reexecução.

alter table cal_events add column if not exists outcome text;          -- texto livre "como correu"
alter table cal_events add column if not exists outcome_at timestamptz; -- quando foi registado o desfecho

-- Eventos passados sem outcome são os que o Phlox pergunta "como correu?".
create index if not exists cal_events_followup_idx
  on cal_events(user_id, starts_at) where outcome is null;
