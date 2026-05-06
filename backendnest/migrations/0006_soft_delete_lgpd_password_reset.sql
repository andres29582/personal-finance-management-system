BEGIN;

ALTER TABLE transacao
  ADD COLUMN IF NOT EXISTS excluido_em timestamp NULL;

ALTER TABLE transferencia
  ADD COLUMN IF NOT EXISTS excluido_em timestamp NULL;

ALTER TABLE pagamento_divida
  ADD COLUMN IF NOT EXISTS excluido_em timestamp NULL;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS lgpd_consentimento_em timestamp NULL;

CREATE TABLE IF NOT EXISTS password_reset_token (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  token_hash char(64) NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_password_reset_token_user_id'
  ) THEN
    ALTER TABLE password_reset_token
      ADD CONSTRAINT fk_password_reset_token_user_id
      FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash
  ON password_reset_token (token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_user_created
  ON password_reset_token (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transacao_excluido
  ON transacao (usuario_id) WHERE excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_transferencia_excluido
  ON transferencia (usuario_id) WHERE excluido_em IS NULL;

COMMIT;
