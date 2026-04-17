BEGIN;

CREATE TABLE IF NOT EXISTS usuario (
  id uuid PRIMARY KEY,
  nome varchar(150) NOT NULL,
  email varchar(150) NOT NULL UNIQUE,
  cpf varchar(11) UNIQUE,
  cep varchar(8),
  endereco varchar(150),
  numero varchar(20),
  cidade varchar(100),
  senha_hash varchar(255) NOT NULL,
  data_registro timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  moeda_padrao varchar(10) NOT NULL DEFAULT 'BRL',
  CONSTRAINT chk_usuario_cpf CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  CONSTRAINT chk_usuario_cep CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$')
);

CREATE TABLE IF NOT EXISTS conta (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nome varchar(150) NOT NULL,
  tipo varchar(20) NOT NULL,
  saldo_inicial numeric(12,2) NOT NULL,
  moeda varchar(10) NOT NULL DEFAULT 'BRL',
  limite_credito numeric(12,2),
  data_corte smallint,
  data_pagamento smallint,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conta_usuario_id ON conta (usuario_id);

CREATE TABLE IF NOT EXISTS categoria (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nome varchar(100) NOT NULL,
  tipo varchar(20) NOT NULL,
  cor varchar(30),
  icone varchar(50),
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categoria_usuario_id ON categoria (usuario_id);

CREATE TABLE IF NOT EXISTS transacao (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  conta_id uuid NOT NULL REFERENCES conta(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categoria(id) ON DELETE RESTRICT,
  tipo varchar(20) NOT NULL,
  valor numeric(14,2) NOT NULL,
  data date NOT NULL,
  descricao text,
  eh_ajuste boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transacao_usuario_id ON transacao (usuario_id);
CREATE INDEX IF NOT EXISTS idx_transacao_data ON transacao (data);

CREATE TABLE IF NOT EXISTS transferencia (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  conta_origem_id uuid NOT NULL REFERENCES conta(id) ON DELETE RESTRICT,
  conta_destino_id uuid NOT NULL REFERENCES conta(id) ON DELETE RESTRICT,
  valor numeric(14,2) NOT NULL,
  data date NOT NULL,
  descricao text,
  comissao numeric(14,2) NOT NULL DEFAULT 0,
  moeda varchar(10) NOT NULL DEFAULT 'BRL',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transferencia_usuario_id ON transferencia (usuario_id);

CREATE TABLE IF NOT EXISTS divida (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  conta_id uuid REFERENCES conta(id) ON DELETE SET NULL,
  nome varchar(150) NOT NULL,
  valor_total numeric(14,2) NOT NULL,
  taxa_juros numeric(5,2),
  parcela_mensal numeric(14,2),
  data_inicio date NOT NULL,
  data_vencimento date NOT NULL,
  proximo_vencimento date,
  periodicidade varchar(20),
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_divida_usuario_id ON divida (usuario_id);

CREATE TABLE IF NOT EXISTS meta (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nome varchar(150) NOT NULL,
  tipo varchar(30) NOT NULL,
  valor_objetivo numeric(14,2) NOT NULL,
  valor_atual numeric(14,2) NOT NULL DEFAULT 0,
  data_limite date,
  conta_id uuid REFERENCES conta(id) ON DELETE SET NULL,
  divida_id uuid REFERENCES divida(id) ON DELETE SET NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meta_usuario_id ON meta (usuario_id);

CREATE TABLE IF NOT EXISTS alerta (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo varchar(50) NOT NULL,
  referencia_id uuid NOT NULL,
  dias_antecedencia integer NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  ultima_notificacao timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerta_usuario_id ON alerta (usuario_id);

CREATE TABLE IF NOT EXISTS orcamento (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  mes_referencia varchar(7) NOT NULL,
  valor_planejado numeric(14,2) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_orcamento_usuario_mes UNIQUE (usuario_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_orcamento_usuario_id ON orcamento (usuario_id);

CREATE TABLE IF NOT EXISTS pagamento_divida (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  divida_id uuid NOT NULL REFERENCES divida(id) ON DELETE CASCADE,
  conta_id uuid NOT NULL REFERENCES conta(id) ON DELETE RESTRICT,
  transacao_id uuid NOT NULL UNIQUE REFERENCES transacao(id) ON DELETE CASCADE,
  valor numeric(14,2) NOT NULL,
  data date NOT NULL,
  descricao text,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pagamento_divida_usuario_id ON pagamento_divida (usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagamento_divida_divida_id ON pagamento_divida (divida_id);

COMMIT;
