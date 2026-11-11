export type Transferencia = {
  comissao: number;
  contaDestinoId: string;
  contaOrigemId: string;
  createdAt: string;
  data: string;
  descricao: string | null;
  id: string;
  moeda: string;
  updatedAt: string;
  usuarioId: string;
  valor: number;
};

export type CreateTransferenciaRequestDto = {
  idempotencyKey?: string;
  comissao?: number;
  contaDestinoId: string;
  contaOrigemId: string;
  data: string;
  descricao?: string;
  valor: number;
};

export type UpdateTransferenciaRequestDto = Partial<
  Pick<CreateTransferenciaRequestDto, 'comissao' | 'data' | 'descricao' | 'valor'>
>;

export type FindTransferenciasParams = { limit?: number; offset?: number };
