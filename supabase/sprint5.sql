-- Sprint 5: Vitals tracking + Prescription optimizer cache

-- Vitals table: heart rate, blood pressure, SpO2, weight, blood glucose, temperature
CREATE TABLE IF NOT EXISTS vitals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  hr          integer,           -- bpm
  bp_sys      integer,           -- mmHg systolic
  bp_dia      integer,           -- mmHg diastolic
  spo2        numeric(4,1),      -- %
  weight      numeric(5,1),      -- kg
  glucose     numeric(5,1),      -- mg/dL
  temp        numeric(4,1),      -- °C
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own vitals"
  ON vitals FOR ALL USING (auth.uid() = user_id);

CREATE INDEX vitals_user_date ON vitals(user_id, recorded_at DESC);
