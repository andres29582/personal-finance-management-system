BEGIN;
CREATE TABLE password_changed_outbox (
  id UUID PRIMARY KEY,
  recipient VARCHAR(150) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  state VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  payload TEXT NULL,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_attempt_at TIMESTAMPTZ NULL,
  lease_until TIMESTAMPTZ NULL,
  claim_token UUID NULL,
  provider_id VARCHAR(128) NULL,
  last_safe_error VARCHAR(64) NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_changed_state CHECK (state IN ('pending','claimed','delivered','simulated','failed','reconciliation')),
  CONSTRAINT password_changed_lease CHECK (
    (state = 'claimed' AND lease_until IS NOT NULL AND claim_token IS NOT NULL)
    OR (state <> 'claimed' AND lease_until IS NULL AND claim_token IS NULL)
  ),
  CONSTRAINT password_changed_frozen CHECK (first_attempt_at IS NULL OR payload IS NOT NULL)
);
CREATE INDEX password_changed_ready ON password_changed_outbox (next_attempt_at, created_at, id) WHERE state = 'pending';
CREATE INDEX password_changed_leases ON password_changed_outbox (lease_until) WHERE state = 'claimed';
COMMIT;
