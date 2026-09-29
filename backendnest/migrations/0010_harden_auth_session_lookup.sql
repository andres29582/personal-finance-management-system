CREATE INDEX IF NOT EXISTS idx_auth_session_active_user_created
  ON auth_session (usuario_id, created_at ASC)
  WHERE revoked_at IS NULL;
