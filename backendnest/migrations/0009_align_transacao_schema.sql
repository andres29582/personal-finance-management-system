BEGIN;

ALTER TABLE public.transacao
  ALTER COLUMN valor TYPE numeric(14,2) USING valor::numeric(14,2),
  ALTER COLUMN descricao TYPE text USING descricao::text;

COMMIT;
