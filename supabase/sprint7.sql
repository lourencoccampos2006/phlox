-- Sprint 7: Daily Brief cache + personal_meds reminder_times

-- Add reminder_times to personal_meds if not already present
ALTER TABLE personal_meds ADD COLUMN IF NOT EXISTS reminder_times text[];
-- example: ["09:00", "13:00", "21:00"]

-- Index for cron job efficiency
CREATE INDEX IF NOT EXISTS personal_meds_user_reminders ON personal_meds(user_id) WHERE reminder_times IS NOT NULL;

-- Daily brief cache (avoid regenerating multiple times per day)
CREATE TABLE IF NOT EXISTS daily_briefs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_date  date        NOT NULL,
  data        jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, brief_date)
);

ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own briefs" ON daily_briefs
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS daily_briefs_user_date ON daily_briefs(user_id, brief_date DESC);

-- Ensure phlox_links table has the policies applied (idempotent re-run safe)
-- Run sprint6.sql first if phlox_links doesn't exist yet
