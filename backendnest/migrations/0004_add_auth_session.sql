CREATE TABLE IF NOT EXISTS auth_session (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  refresh_token_hash varchar(255) NOT NULL,
  expires_at timestamp NOT NULL,
  revoked_at timestamp NULL,
  last_used_at timestamp NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_session_usuario_id
  ON auth_session (usuario_id);

CREATE INDEX IF NOT EXISTS idx_auth_session_expires_at
  ON auth_session (expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_session_revoked_at
  ON auth_session (revoked_at);
