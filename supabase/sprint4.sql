-- Sprint 4: Emergency Cards + Refill Tracking

-- Emergency medication card tokens (shareable public link, no auth needed to view)
CREATE TABLE IF NOT EXISTS emergency_tokens (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text    NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  name       text,
  allergies  text,
  blood_type text,
  emergency_contact text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS emergency_tokens_user_idx  ON emergency_tokens(user_id);
CREATE INDEX        IF NOT EXISTS emergency_tokens_token_idx ON emergency_tokens(token);

ALTER TABLE emergency_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_emergency_tokens" ON emergency_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Public read via service role key (API route bypasses RLS with service role)

-- Optional: track quantity of tablets/doses for refill prediction
ALTER TABLE personal_meds ADD COLUMN IF NOT EXISTS quantity_remaining integer;
ALTER TABLE personal_meds ADD COLUMN IF NOT EXISTS quantity_per_dose numeric;  -- e.g. 1, 0.5, 2
ALTER TABLE personal_meds ADD COLUMN IF NOT EXISTS refill_reminded_at timestamptz;
