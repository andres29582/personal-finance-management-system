export type TipoConta = 'dinheiro' | 'banco' | 'poupanca' | 'cartao_credito';

export type Conta = {
  id: string;
  usuarioId: string;
  nome: string;
  tipo: TipoConta;
  saldoInicial: number;
  saldoAtual: number;
  moeda: string;
  limiteCredito: number | null;
  dataCorte: number | null;
  dataPagamento: number | null;
  ativa: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateContaRequestDto = {
  nome: string;
  tipo: TipoConta;
  saldoInicial: number;
  limiteCredito?: number;
  dataCorte?: number;
  dataPagamento?: number;
};

export type UpdateContaRequestDto = {
  nome?: string;
  limiteCredito?: number;
  dataCorte?: number;
  dataPagamento?: number;
  ativa?: boolean;
};
