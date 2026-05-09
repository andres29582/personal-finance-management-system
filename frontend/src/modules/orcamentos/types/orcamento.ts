export type OrcamentoStatus = 'alerta_80' | 'estourado' | 'normal';

export type Orcamento = {
  createdAt: string;
  gastoAtual: number;
  id: string;
  mesReferencia: string;
  percentualUtilizado: number;
  restante: number;
  statusAlerta: OrcamentoStatus;
  updatedAt: string;
  usuarioId: string;
  valorPlanejado: number;
};

export type CreateOrcamentoRequestDto = {
  mesReferencia: string;
  valorPlanejado: number;
};

export type UpdateOrcamentoRequestDto = {
  valorPlanejado?: number;
};
