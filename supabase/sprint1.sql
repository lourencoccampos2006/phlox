-- ─────────────────────────────────────────────────────────────────────────────
-- Phlox Clinical — Sprint 1
-- Executar no Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Adicionar colunas ao profiles existente ───────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS experience_mode text DEFAULT 'personal'
    CHECK (experience_mode IN ('clinical', 'caregiver', 'personal', 'student')),
  ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;

-- ─── 2. Perfis familiares (para utilizadores cuidadores) ──────────────────────

CREATE TABLE IF NOT EXISTS family_profiles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name        text        NOT NULL,
  relation    text,
  age         integer,
  sex         text        CHECK (sex IN ('M', 'F', 'outro')),
  weight      numeric,
  height      numeric,
  creatinine  numeric,
  conditions  text,
  allergies   text,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ─── 3. Medicamentos dos perfis familiares ────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_profile_meds (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid        REFERENCES family_profiles(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name        text        NOT NULL,
  dose        text,
  frequency   text,
  indication  text,
  started_at  date,
  created_at  timestamptz DEFAULT now()
);

-- ─── 4. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE family_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_profile_meds   ENABLE ROW LEVEL SECURITY;

-- Drop antes de criar (evita conflitos em re-runs)
DROP POLICY IF EXISTS "user owns family profiles"     ON family_profiles;
DROP POLICY IF EXISTS "user owns family profile meds" ON family_profile_meds;

CREATE POLICY "user owns family profiles"
  ON family_profiles
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "user owns family profile meds"
  ON family_profile_meds
  FOR ALL
  USING (auth.uid() = user_id);

-- ─── 5. Índices úteis ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_family_profiles_user_id
  ON family_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_family_profile_meds_profile_id
  ON family_profile_meds (profile_id);

CREATE INDEX IF NOT EXISTS idx_family_profile_meds_user_id
  ON family_profile_meds (user_id);
