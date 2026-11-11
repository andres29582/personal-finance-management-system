-- One bounded, shared account window. No device or credential metadata.
CREATE TABLE auth_session_reauthentication (
  usuario_id uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL CHECK (isfinite(window_started_at)),
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 5)
);

-- Stable owner-scoped keyset pages; response cardinality is independent of login limits.
CREATE INDEX auth_session_owner_authenticated_idx
  ON auth_session (usuario_id, authenticated_at DESC, id DESC)
  WHERE revoked_at IS NULL AND policy_version = 1;
