BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.planejamento (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  usuario_criador_id uuid NOT NULL,
  nome character varying(150) NOT NULL,
  descricao character varying(500) NULL,
  tipo character varying(20) NOT NULL,
  status character varying(20) DEFAULT 'ABERTO' NOT NULL,
  data_inicio date NULL,
  data_fim date NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at timestamp without time zone NULL
);

CREATE TABLE IF NOT EXISTS public.participante_planejamento (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  planejamento_id uuid NOT NULL,
  usuario_id uuid NULL,
  nome character varying(150) NOT NULL,
  email character varying(150) NULL,
  tipo character varying(20) DEFAULT 'MANUAL' NOT NULL,
  status character varying(20) DEFAULT 'ATIVO' NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.gasto_planejamento (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  planejamento_id uuid NOT NULL,
  descricao character varying(255) NOT NULL,
  valor_centavos integer NOT NULL,
  data_gasto date NOT NULL,
  categoria character varying(100) NULL,
  comportamento character varying(20) NOT NULL,
  status character varying(20) DEFAULT 'ATIVO' NOT NULL,
  pago_por_participante_id uuid NOT NULL,
  observacao character varying(500) NULL,
  comprovante_url character varying(500) NULL,
  comprovante_nome character varying(255) NULL,
  mes_referencia character varying(7) NULL,
  ultima_alteracao_valor_em timestamp without time zone NULL,
  requer_revisao_mensal boolean DEFAULT false NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at timestamp without time zone NULL
);

CREATE TABLE IF NOT EXISTS public.divisao_gasto (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  gasto_id uuid NOT NULL,
  participante_id uuid NOT NULL,
  valor_devido_centavos integer NOT NULL,
  status character varying(20) DEFAULT 'ATIVA' NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.acerto_planejamento (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  planejamento_id uuid NOT NULL,
  de_participante_id uuid NOT NULL,
  para_participante_id uuid NOT NULL,
  valor_centavos integer NOT NULL,
  status character varying(20) DEFAULT 'PENDENTE' NOT NULL,
  data_pagamento timestamp without time zone NULL,
  observacao character varying(500) NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planejamento_pkey'
  ) THEN
    ALTER TABLE ONLY public.planejamento
      ADD CONSTRAINT planejamento_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participante_planejamento_pkey'
  ) THEN
    ALTER TABLE ONLY public.participante_planejamento
      ADD CONSTRAINT participante_planejamento_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gasto_planejamento_pkey'
  ) THEN
    ALTER TABLE ONLY public.gasto_planejamento
      ADD CONSTRAINT gasto_planejamento_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'divisao_gasto_pkey'
  ) THEN
    ALTER TABLE ONLY public.divisao_gasto
      ADD CONSTRAINT divisao_gasto_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'acerto_planejamento_pkey'
  ) THEN
    ALTER TABLE ONLY public.acerto_planejamento
      ADD CONSTRAINT acerto_planejamento_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_planejamento_tipo'
  ) THEN
    ALTER TABLE ONLY public.planejamento
      ADD CONSTRAINT chk_planejamento_tipo
      CHECK ((tipo)::text IN ('CASA', 'FESTA', 'VIAGEM', 'EVENTO', 'GRUPO', 'OUTRO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_planejamento_status'
  ) THEN
    ALTER TABLE ONLY public.planejamento
      ADD CONSTRAINT chk_planejamento_status
      CHECK ((status)::text IN ('ABERTO', 'FECHADO', 'ARQUIVADO', 'CANCELADO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_participante_planejamento_tipo'
  ) THEN
    ALTER TABLE ONLY public.participante_planejamento
      ADD CONSTRAINT chk_participante_planejamento_tipo
      CHECK ((tipo)::text IN ('MANUAL', 'CONVIDADO', 'VINCULADO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_participante_planejamento_status'
  ) THEN
    ALTER TABLE ONLY public.participante_planejamento
      ADD CONSTRAINT chk_participante_planejamento_status
      CHECK ((status)::text IN ('ATIVO', 'PENDENTE', 'REMOVIDO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_gasto_planejamento_comportamento'
  ) THEN
    ALTER TABLE ONLY public.gasto_planejamento
      ADD CONSTRAINT chk_gasto_planejamento_comportamento
      CHECK ((comportamento)::text IN ('FIXO', 'VARIAVEL', 'EVENTUAL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_gasto_planejamento_status'
  ) THEN
    ALTER TABLE ONLY public.gasto_planejamento
      ADD CONSTRAINT chk_gasto_planejamento_status
      CHECK ((status)::text IN ('ATIVO', 'CANCELADO', 'PENDENTE_REVISAO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_gasto_planejamento_valor'
  ) THEN
    ALTER TABLE ONLY public.gasto_planejamento
      ADD CONSTRAINT chk_gasto_planejamento_valor
      CHECK (valor_centavos > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_gasto_planejamento_mes_referencia'
  ) THEN
    ALTER TABLE ONLY public.gasto_planejamento
      ADD CONSTRAINT chk_gasto_planejamento_mes_referencia
      CHECK (mes_referencia IS NULL OR (mes_referencia)::text ~ '^[0-9]{4}-[0-9]{2}$'::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_divisao_gasto_status'
  ) THEN
    ALTER TABLE ONLY public.divisao_gasto
      ADD CONSTRAINT chk_divisao_gasto_status
      CHECK ((status)::text IN ('ATIVA', 'CANCELADA'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_divisao_gasto_valor'
  ) THEN
    ALTER TABLE ONLY public.divisao_gasto
      ADD CONSTRAINT chk_divisao_gasto_valor
      CHECK (valor_devido_centavos > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_acerto_planejamento_status'
  ) THEN
    ALTER TABLE ONLY public.acerto_planejamento
      ADD CONSTRAINT chk_acerto_planejamento_status
      CHECK ((status)::text IN ('PENDENTE', 'PAGO', 'CONFIRMADO', 'CANCELADO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_acerto_planejamento_valor'
  ) THEN
    ALTER TABLE ONLY public.acerto_planejamento
      ADD CONSTRAINT chk_acerto_planejamento_valor
      CHECK (valor_centavos > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_planejamento_usuario_criador'
  ) THEN
    ALTER TABLE ONLY public.planejamento
      ADD CONSTRAINT fk_planejamento_usuario_criador
      FOREIGN KEY (usuario_criador_id) REFERENCES public.usuario(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_participante_planejamento_planejamento'
  ) THEN
    ALTER TABLE ONLY public.participante_planejamento
      ADD CONSTRAINT fk_participante_planejamento_planejamento
      FOREIGN KEY (planejamento_id) REFERENCES public.planejamento(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_participante_planejamento_usuario'
  ) THEN
    ALTER TABLE ONLY public.participante_planejamento
      ADD CONSTRAINT fk_participante_planejamento_usuario
      FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gasto_planejamento_planejamento'
  ) THEN
    ALTER TABLE ONLY public.gasto_planejamento
      ADD CONSTRAINT fk_gasto_planejamento_planejamento
      FOREIGN KEY (planejamento_id) REFERENCES public.planejamento(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gasto_planejamento_pagador'
  ) THEN
    ALTER TABLE ONLY public.gasto_planejamento
      ADD CONSTRAINT fk_gasto_planejamento_pagador
      FOREIGN KEY (pago_por_participante_id) REFERENCES public.participante_planejamento(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_divisao_gasto_gasto'
  ) THEN
    ALTER TABLE ONLY public.divisao_gasto
      ADD CONSTRAINT fk_divisao_gasto_gasto
      FOREIGN KEY (gasto_id) REFERENCES public.gasto_planejamento(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_divisao_gasto_participante'
  ) THEN
    ALTER TABLE ONLY public.divisao_gasto
      ADD CONSTRAINT fk_divisao_gasto_participante
      FOREIGN KEY (participante_id) REFERENCES public.participante_planejamento(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_acerto_planejamento_planejamento'
  ) THEN
    ALTER TABLE ONLY public.acerto_planejamento
      ADD CONSTRAINT fk_acerto_planejamento_planejamento
      FOREIGN KEY (planejamento_id) REFERENCES public.planejamento(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_acerto_planejamento_de_participante'
  ) THEN
    ALTER TABLE ONLY public.acerto_planejamento
      ADD CONSTRAINT fk_acerto_planejamento_de_participante
      FOREIGN KEY (de_participante_id) REFERENCES public.participante_planejamento(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_acerto_planejamento_para_participante'
  ) THEN
    ALTER TABLE ONLY public.acerto_planejamento
      ADD CONSTRAINT fk_acerto_planejamento_para_participante
      FOREIGN KEY (para_participante_id) REFERENCES public.participante_planejamento(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_planejamento_usuario_criador
  ON public.planejamento (usuario_criador_id);

CREATE INDEX IF NOT EXISTS idx_planejamento_usuario_status
  ON public.planejamento (usuario_criador_id, status);

CREATE INDEX IF NOT EXISTS idx_planejamento_usuario_ativo
  ON public.planejamento (usuario_criador_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_participante_planejamento
  ON public.participante_planejamento (planejamento_id);

CREATE INDEX IF NOT EXISTS idx_participante_planejamento_status
  ON public.participante_planejamento (planejamento_id, status);

CREATE INDEX IF NOT EXISTS idx_participante_planejamento_usuario_status
  ON public.participante_planejamento (usuario_id, status) WHERE usuario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_participante_planejamento_usuario_ativo_unico
  ON public.participante_planejamento (planejamento_id, usuario_id)
  WHERE usuario_id IS NOT NULL AND status = 'ATIVO';

CREATE UNIQUE INDEX IF NOT EXISTS idx_participante_planejamento_email_ativo_unico
  ON public.participante_planejamento (planejamento_id, email)
  WHERE email IS NOT NULL AND status = 'ATIVO';

CREATE INDEX IF NOT EXISTS idx_gasto_planejamento
  ON public.gasto_planejamento (planejamento_id);

CREATE INDEX IF NOT EXISTS idx_gasto_planejamento_status
  ON public.gasto_planejamento (planejamento_id, status);

CREATE INDEX IF NOT EXISTS idx_gasto_planejamento_pagador
  ON public.gasto_planejamento (pago_por_participante_id);

CREATE INDEX IF NOT EXISTS idx_divisao_gasto
  ON public.divisao_gasto (gasto_id);

CREATE INDEX IF NOT EXISTS idx_divisao_gasto_participante
  ON public.divisao_gasto (participante_id);

CREATE INDEX IF NOT EXISTS idx_acerto_planejamento
  ON public.acerto_planejamento (planejamento_id);

CREATE INDEX IF NOT EXISTS idx_acerto_planejamento_status
  ON public.acerto_planejamento (planejamento_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_acerto_planejamento_pendente_unico
  ON public.acerto_planejamento (
    planejamento_id,
    de_participante_id,
    para_participante_id,
    valor_centavos
  )
  WHERE status = 'PENDENTE';

COMMIT;
