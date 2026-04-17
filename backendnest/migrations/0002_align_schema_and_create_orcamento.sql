BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'divida'
      AND column_name = 'proximo_vencimiento'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'divida'
      AND column_name = 'proximo_vencimento'
  ) THEN
    ALTER TABLE public.divida
      RENAME COLUMN proximo_vencimiento TO proximo_vencimento;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meta'
      AND column_name = 'monto_objetivo'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meta'
      AND column_name = 'valor_objetivo'
  ) THEN
    ALTER TABLE public.meta
      RENAME COLUMN monto_objetivo TO valor_objetivo;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meta'
      AND column_name = 'monto_actual'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meta'
      AND column_name = 'valor_atual'
  ) THEN
    ALTER TABLE public.meta
      RENAME COLUMN monto_actual TO valor_atual;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meta'
      AND column_name = 'fecha_limite'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meta'
      AND column_name = 'data_limite'
  ) THEN
    ALTER TABLE public.meta
      RENAME COLUMN fecha_limite TO data_limite;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alerta'
      AND column_name = 'dias_anticipacion'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alerta'
      AND column_name = 'dias_antecedencia'
  ) THEN
    ALTER TABLE public.alerta
      RENAME COLUMN dias_anticipacion TO dias_antecedencia;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alerta'
      AND column_name = 'ultima_notificacion'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alerta'
      AND column_name = 'ultima_notificacao'
  ) THEN
    ALTER TABLE public.alerta
      RENAME COLUMN ultima_notificacion TO ultima_notificacao;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'pago_divida'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'pagamento_divida'
  ) THEN
    ALTER TABLE public.pago_divida
      RENAME TO pagamento_divida;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.orcamento (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  usuario_id uuid NOT NULL,
  mes_referencia character varying(7) NOT NULL,
  valor_planejado numeric(14,2) NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orcamento_pkey'
  ) THEN
    ALTER TABLE ONLY public.orcamento
      ADD CONSTRAINT orcamento_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_orcamento_usuario_mes'
  ) THEN
    ALTER TABLE ONLY public.orcamento
      ADD CONSTRAINT uq_orcamento_usuario_mes UNIQUE (usuario_id, mes_referencia);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_orcamento_mes_referencia'
  ) THEN
    ALTER TABLE ONLY public.orcamento
      ADD CONSTRAINT chk_orcamento_mes_referencia
      CHECK ((mes_referencia)::text ~ '^[0-9]{4}-[0-9]{2}$'::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_orcamento_valor_planejado'
  ) THEN
    ALTER TABLE ONLY public.orcamento
      ADD CONSTRAINT chk_orcamento_valor_planejado
      CHECK (valor_planejado > 0::numeric);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_orcamento_usuario'
  ) THEN
    ALTER TABLE ONLY public.orcamento
      ADD CONSTRAINT fk_orcamento_usuario
      FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orcamento_usuario_id
  ON public.orcamento USING btree (usuario_id);

CREATE INDEX IF NOT EXISTS idx_orcamento_mes_referencia
  ON public.orcamento USING btree (mes_referencia);

COMMIT;
