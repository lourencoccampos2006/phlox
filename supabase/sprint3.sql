-- ─────────────────────────────────────────────────────────────────────────────
-- Phlox — Sprint 3: Push Notifications + Medication Logs
-- Executar no Supabase Dashboard → SQL Editor
-- Seguro para re-executar (IF NOT EXISTS em tudo)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Horários de lembrete em personal_meds ────────────────────────────────
-- Ex: ["09:00", "13:00", "21:00"]

ALTER TABLE personal_meds
  ADD COLUMN IF NOT EXISTS reminder_times text[];

-- ─── 2. Subscrições Web Push por dispositivo ─────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL UNIQUE,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user owns push subscriptions" ON push_subscriptions;
CREATE POLICY "user owns push subscriptions"
  ON push_subscriptions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS for cron deletion of expired subs (no policy needed)

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions (user_id);

-- ─── 3. Registo de tomas de medicação ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS med_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  med_id      uuid        NOT NULL REFERENCES personal_meds(id) ON DELETE CASCADE,
  date        date        NOT NULL DEFAULT current_date,
  logged_at   timestamptz NOT NULL DEFAULT now(),
  status      text        NOT NULL DEFAULT 'taken'
                            CHECK (status IN ('taken', 'skipped', 'snoozed'))
);

ALTER TABLE med_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user owns med logs" ON med_logs;
CREATE POLICY "user owns med logs"
  ON med_logs FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_med_logs_user_date
  ON med_logs (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_med_logs_med_date
  ON med_logs (med_id, date);

-- ─── 4. Deduplicação de notificações enviadas pelo cron ──────────────────────

CREATE TABLE IF NOT EXISTS push_notifications_sent (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tag         text        NOT NULL UNIQUE,
  sent_at     timestamptz NOT NULL DEFAULT now()
);

-- Sem RLS — apenas service role escreve nesta tabela (via cron)
-- Limpar registos antigos automaticamente (>3 dias)
CREATE INDEX IF NOT EXISTS idx_push_notif_sent_tag
  ON push_notifications_sent (tag);

CREATE INDEX IF NOT EXISTS idx_push_notif_sent_at
  ON push_notifications_sent (sent_at);
