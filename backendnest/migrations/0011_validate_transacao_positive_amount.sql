BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Includes soft-deleted rows; never silently rewrite financial history.
DO $$
DECLARE
  zeros bigint;
  negatives bigint;
  nans bigint;
BEGIN
  SELECT count(*) FILTER (WHERE valor = 0),
         count(*) FILTER (WHERE valor < 0),
         count(*) FILTER (WHERE valor = 'NaN'::numeric)
    INTO zeros, negatives, nans
    FROM public.transacao;
  IF zeros + negatives + nans > 0 THEN
    RAISE EXCEPTION 'TRANSACAO_INVALID_AMOUNTS: zero=% negative=% nan=%',
      zeros, negatives, nans USING ERRCODE = '23514';
  END IF;
END $$;

-- Validates all rows again under the DDL lock, including concurrent writes.
ALTER TABLE public.transacao
  ADD CONSTRAINT chk_transacao_valor_positivo
  CHECK (valor > 0 AND valor <> 'NaN'::numeric);

COMMIT;
