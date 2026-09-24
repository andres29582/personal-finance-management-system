BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_transacao_valor_positivo'
      AND conrelid = 'public.transacao'::regclass
  ) THEN
    ALTER TABLE public.transacao
      ADD CONSTRAINT chk_transacao_valor_positivo CHECK (valor > 0);
  END IF;
END $$;

COMMIT;
