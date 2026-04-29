-- ─────────────────────────────────────────────────────────────────────────────
-- Phlox Clinical — Sprint 2
-- Executar no Supabase Dashboard → SQL Editor
-- SEGURO para re-executar (idempotente — faz DROP + CREATE)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Limpar tabelas de execuções anteriores (CASCADE mantém dependências) ─────
DROP TABLE IF EXISTS patient_meds   CASCADE;
DROP TABLE IF EXISTS patients       CASCADE;
DROP TABLE IF EXISTS diary_entries  CASCADE;
DROP TABLE IF EXISTS personal_meds  CASCADE;

-- ─── 1. Medicamentos pessoais do utilizador ───────────────────────────────────

CREATE TABLE personal_meds (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  dose         text,
  frequency    text,
  indication   text,
  started_at   date,
  active       boolean     NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Diário de saúde pessoal ───────────────────────────────────────────────

CREATE TABLE diary_entries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date   date        NOT NULL DEFAULT current_date,
  wellbeing    integer     CHECK (wellbeing BETWEEN 1 AND 5),
  symptoms     text[]      NOT NULL DEFAULT '{}',
  notes        text,
  medications  text[]      NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

-- ─── 3. Doentes clínicos (plano Pro/Clínic) ───────────────────────────────────

CREATE TABLE patients (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  age          integer,
  sex          text        CHECK (sex IN ('M', 'F', 'outro')),
  weight       numeric,
  height       numeric,
  creatinine   numeric,
  egfr         numeric,
  conditions   text,
  allergies    text,
  notes        text,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. Medicamentos dos doentes clínicos ────────────────────────────────────

CREATE TABLE patient_meds (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  dose         text,
  frequency    text,
  indication   text,
  route        text        NOT NULL DEFAULT 'oral',
  started_at   date,
  stopped_at   date,
  active       boolean     NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE personal_meds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_meds    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns personal meds"
  ON personal_meds FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user owns diary entries"
  ON diary_entries FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user owns patients"
  ON patients FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user owns patient meds"
  ON patient_meds FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 6. Índices ───────────────────────────────────────────────────────────────

CREATE INDEX idx_personal_meds_user_active   ON personal_meds  (user_id, active);
CREATE INDEX idx_diary_entries_user_date     ON diary_entries   (user_id, entry_date DESC);
CREATE INDEX idx_patients_user_active        ON patients        (user_id, active);
CREATE INDEX idx_patient_meds_patient_id     ON patient_meds    (patient_id);
CREATE INDEX idx_patient_meds_user_id        ON patient_meds    (user_id);

-- ─── 7. Trigger updated_at automático ────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_personal_meds_updated_at
  BEFORE UPDATE ON personal_meds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_diary_entries_updated_at
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
