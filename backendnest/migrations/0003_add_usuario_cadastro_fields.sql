BEGIN;

ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS cpf varchar(11),
  ADD COLUMN IF NOT EXISTS cep varchar(8),
  ADD COLUMN IF NOT EXISTS endereco varchar(150),
  ADD COLUMN IF NOT EXISTS numero varchar(20),
  ADD COLUMN IF NOT EXISTS cidade varchar(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_usuario_cpf'
  ) THEN
    ALTER TABLE ONLY public.usuario
      ADD CONSTRAINT chk_usuario_cpf
      CHECK (cpf IS NULL OR (cpf)::text ~ '^[0-9]{11}$'::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_usuario_cep'
  ) THEN
    ALTER TABLE ONLY public.usuario
      ADD CONSTRAINT chk_usuario_cep
      CHECK (cep IS NULL OR (cep)::text ~ '^[0-9]{8}$'::text);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_cpf
  ON public.usuario USING btree (cpf)
  WHERE cpf IS NOT NULL;

COMMIT;
