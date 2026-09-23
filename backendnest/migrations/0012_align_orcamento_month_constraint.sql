BEGIN;

ALTER TABLE public.orcamento
  DROP CONSTRAINT IF EXISTS chk_orcamento_mes_referencia;

ALTER TABLE public.orcamento
  ADD CONSTRAINT chk_orcamento_mes_referencia
  CHECK (mes_referencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

COMMIT;
