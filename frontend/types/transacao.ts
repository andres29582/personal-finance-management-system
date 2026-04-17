export type TipoTransacao = 'despesa' | 'receita';

export type Transacao = {
  categoriaId: string;
  contaId: string;
  createdAt: string;
  data: string;
  descricao: string | null;
  ehAjuste: boolean;
  id: string;
  tipo: TipoTransacao;
  updatedAt: string;
  usuarioId: string;
  valor: number;
};

export type CreateTransacaoRequestDto = {
  categoriaId: string;
  contaId: string;
  data: string;
  descricao?: string;
  ehAjuste?: boolean;
  tipo: TipoTransacao;
  valor: number;
};

export type UpdateTransacaoRequestDto = Partial<CreateTransacaoRequestDto>;

export type FindTransacoesParams = {
  categoriaId?: string;
  contaId?: string;
  mes?: string;
  tipo?: TipoTransacao;
};
