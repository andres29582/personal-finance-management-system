-- Drain old writers before activation; rollback must keep U4 enforcement.
ALTER TABLE auth_session
  ADD COLUMN IF NOT EXISTS authenticated_at timestamptz,
  ADD COLUMN IF NOT EXISTS absolute_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS idle_timeout_seconds integer,
  ADD COLUMN IF NOT EXISTS policy_version integer,
  ADD COLUMN IF NOT EXISTS terminal_reason varchar(64);

-- Legacy timezone/activity provenance is unknown: invalidate, never invent timers.
UPDATE auth_session SET revoked_at = clock_timestamp(), terminal_reason = 'AUTH_INVALID_SESSION'
WHERE policy_version IS NULL AND revoked_at IS NULL;

ALTER TABLE auth_session ADD CONSTRAINT auth_session_policy_shape CHECK (
  (policy_version IS NULL AND revoked_at IS NOT NULL) OR
  (policy_version IS NOT NULL AND policy_version = 1 AND authenticated_at IS NOT NULL AND absolute_expires_at IS NOT NULL
   AND last_activity_at IS NOT NULL AND refresh_expires_at IS NOT NULL
   AND idle_timeout_seconds IS NOT NULL AND idle_timeout_seconds BETWEEN 1 AND 31536000
   AND absolute_expires_at > authenticated_at
   AND last_activity_at >= authenticated_at
   AND last_activity_at < absolute_expires_at
   AND refresh_expires_at <= absolute_expires_at)
);
