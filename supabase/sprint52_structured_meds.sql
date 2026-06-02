-- sprint52_structured_meds.sql
-- Phlox — Posologia estruturada em JSONB.
--
-- Em vez de "1 cp ao pequeno-almoço e jantar" como texto livre, guardamos:
--   {
--     "dose_amount": 1,
--     "dose_unit":   "cp",          -- 'mg'|'g'|'mcg'|'mL'|'UI'|'gtt'|'amp'|'cp'|'puff'|'mL/h'
--     "frequency_per_day": 2,
--     "schedule_times": ["08:00","20:00"],
--     "duration_days": 7,            -- null = crónica
--     "prn":            false,
--     "prn_indication": null,
--     "route":          "oral",      -- 'oral'|'sc'|'im'|'iv'|'inh'|'top'|'rct'|'nas'|'sl'|'tt'
--     "with_food":      null,        -- true|false|null
--     "notes":          null
--   }
--
-- Mantemos os campos antigos (dose, frequency em texto) para retro-compat —
-- a função render_posology() devolve um texto humano a partir do JSONB.

do $$ begin
  alter table personal_meds       add column if not exists posology_json jsonb;
exception when undefined_table then null; end $$;

do $$ begin
  alter table family_profile_meds add column if not exists posology_json jsonb;
exception when undefined_table then null; end $$;

do $$ begin
  alter table patient_meds        add column if not exists posology_json jsonb;
exception when undefined_table then null; end $$;

-- Função utilitária — gera texto legível
create or replace function render_posology(p jsonb) returns text
language plpgsql immutable as $$
declare
  out text := '';
  amt numeric;
  unit text;
  freq int;
  times jsonb;
  dur int;
  route text;
  prn boolean;
  fd text;
begin
  if p is null then return null; end if;
  amt   := (p->>'dose_amount')::numeric;
  unit  := coalesce(p->>'dose_unit','');
  freq  := nullif(p->>'frequency_per_day','')::int;
  times := p->'schedule_times';
  dur   := nullif(p->>'duration_days','')::int;
  route := coalesce(p->>'route','');
  prn   := coalesce((p->>'prn')::boolean, false);
  fd    := coalesce(p->>'with_food','');

  if amt is not null then out := out || amt::text; end if;
  if unit <> '' then out := out || ' ' || unit; end if;
  if freq is not null then out := out || ' · ' || freq::text || 'x/dia'; end if;
  if jsonb_array_length(coalesce(times,'[]'::jsonb)) > 0 then
    out := out || ' (' || (
      select string_agg(value, ', ')
      from jsonb_array_elements_text(times)
    ) || ')';
  end if;
  if route <> '' then out := out || ' · ' || route; end if;
  if dur is not null then out := out || ' durante ' || dur::text || ' dias'; end if;
  if prn then out := out || ' · SOS'; end if;
  if fd = 'true' then out := out || ' · com comida';
  elsif fd = 'false' then out := out || ' · em jejum'; end if;
  return trim(out);
end;
$$;
