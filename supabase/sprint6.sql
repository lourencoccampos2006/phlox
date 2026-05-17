-- Sprint 6: Phlox Link ecosystem

-- Phlox Link: shareable health data connections
CREATE TABLE IF NOT EXISTS phlox_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code varchar(12) NOT NULL UNIQUE,
  label text,
  access_level varchar(20) NOT NULL DEFAULT 'meds_only',
  -- meds_only: só medicação
  -- meds_vitals: medicação + sinais vitais
  -- full: tudo incluindo condições e alergias
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE phlox_links ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Users manage own links" ON phlox_links
  FOR ALL USING (auth.uid() = user_id);

-- Anyone can read active links (needed for public sharing)
CREATE POLICY "Public read active links" ON phlox_links
  FOR SELECT USING (active = true);

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS phlox_links_code ON phlox_links(code);
CREATE INDEX IF NOT EXISTS phlox_links_user ON phlox_links(user_id);
