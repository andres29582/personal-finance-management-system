BEGIN;
ALTER TABLE password_reset_token ADD COLUMN invalidated_at TIMESTAMP NULL;
ALTER TABLE password_reset_token ADD CONSTRAINT password_reset_token_terminal_state
  CHECK (used_at IS NULL OR invalidated_at IS NULL);
COMMIT;
