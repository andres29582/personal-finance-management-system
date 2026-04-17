BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  level varchar(20) NOT NULL,
  event varchar(60) NOT NULL,
  module varchar(40) NOT NULL,
  action varchar(40) NOT NULL,

  success boolean NOT NULL DEFAULT true,
  message varchar(255) NULL,

  user_id uuid NULL,
  entity varchar(40) NULL,
  entity_id uuid NULL,

  method varchar(10) NULL,
  route varchar(255) NULL,
  status_code integer NULL,

  ip varchar(45) NULL,
  user_agent varchar(255) NULL,

  details jsonb NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_audit_log_user_id'
  ) THEN
    ALTER TABLE audit_log
      ADD CONSTRAINT fk_audit_log_user_id
      FOREIGN KEY (user_id)
      REFERENCES usuario(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created_at
  ON audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event
  ON audit_log (event);

CREATE INDEX IF NOT EXISTS idx_audit_log_module
  ON audit_log (module);

CREATE INDEX IF NOT EXISTS idx_audit_log_status_code
  ON audit_log (status_code);

COMMIT;
