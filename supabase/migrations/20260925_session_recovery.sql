-- Session recovery: track login attempts, alert after 10 failures/day, one alert per incident.
-- Part of the auto-recovery system: VPS re-logs in with password + TOTP when session dies.

-- Every login attempt (manual verify or auto-recovery), success or fail.
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,          -- 'account2' | 'account3'
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  method text NOT NULL DEFAULT 'verify'  -- 'verify' | 'auto_relogin'
);
CREATE INDEX IF NOT EXISTS login_attempts_acct_day
  ON public.login_attempts (account_key, attempted_at DESC);

-- Alerts: one row per incident. dedupe_key guarantees "send once, never repeat".
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,                 -- 'session_dead'
  account_key text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,        -- set when user dismisses in dashboard
  dedupe_key text UNIQUE              -- e.g. 'session_dead:account2:2026-09-25'
);
CREATE INDEX IF NOT EXISTS alerts_unacked
  ON public.alerts (created_at DESC) WHERE acknowledged_at IS NULL;

-- Anon key: read attempts + alerts, insert attempts, upsert alerts.
-- (Dashboard + VPS both use the anon key.)
DROP POLICY IF EXISTS "la_select" ON public.login_attempts;
DROP POLICY IF EXISTS "la_insert" ON public.login_attempts;
CREATE POLICY "la_select" ON public.login_attempts FOR SELECT USING (true);
CREATE POLICY "la_insert" ON public.login_attempts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "al_select" ON public.alerts;
DROP POLICY IF EXISTS "al_insert" ON public.alerts;
DROP POLICY IF EXISTS "al_update" ON public.alerts;
CREATE POLICY "al_select" ON public.alerts FOR SELECT USING (true);
CREATE POLICY "al_insert" ON public.alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "al_update" ON public.alerts FOR UPDATE USING (true);
