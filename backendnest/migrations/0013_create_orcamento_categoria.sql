BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.orcamento_categoria (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  orcamento_id uuid NOT NULL,
  categoria_id uuid NOT NULL,
  valor_planejado numeric(14,2) NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT orcamento_categoria_pkey PRIMARY KEY (id),
  CONSTRAINT uq_orcamento_categoria UNIQUE (orcamento_id, categoria_id),
  CONSTRAINT chk_orcamento_categoria_valor_planejado
    CHECK (valor_planejado > 0::numeric),
  CONSTRAINT fk_orcamento_categoria_orcamento
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamento(id) ON DELETE CASCADE,
  CONSTRAINT fk_orcamento_categoria_categoria
    FOREIGN KEY (categoria_id) REFERENCES public.categoria(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_orcamento_categoria_categoria_id
  ON public.orcamento_categoria (categoria_id);

COMMIT;
