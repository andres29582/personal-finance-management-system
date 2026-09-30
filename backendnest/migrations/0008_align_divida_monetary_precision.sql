BEGIN;

ALTER TABLE public.divida
  ALTER COLUMN valor_total TYPE numeric(14,2) USING valor_total::numeric(14,2),
  ALTER COLUMN parcela_mensal TYPE numeric(14,2) USING parcela_mensal::numeric(14,2);

COMMIT;
