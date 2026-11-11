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

export type UpdateTransacaoRequestDto =
  Partial<Omit<CreateTransacaoRequestDto, 'descricao' | 'ehAjuste'>> & {
    descricao?: string | null;
  };

export type FindTransacoesParams = {
  limit?: number;
  offset?: number;
  categoriaId?: string;
  contaId?: string;
  mes?: string;
  tipo?: TipoTransacao;
};
