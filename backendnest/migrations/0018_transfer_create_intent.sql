BEGIN;

ALTER TABLE transferencia
  ADD COLUMN idempotency_key uuid,
  ADD COLUMN idempotency_fingerprint varchar(64),
  ADD CONSTRAINT ck_transferencia_idempotency_pair CHECK (
    (idempotency_key IS NULL) = (idempotency_fingerprint IS NULL)
  );

-- Include soft-deleted rows: deleting a transfer must not release its intent.
CREATE UNIQUE INDEX uq_transferencia_usuario_idempotency
  ON transferencia (usuario_id, idempotency_key);

COMMIT;
