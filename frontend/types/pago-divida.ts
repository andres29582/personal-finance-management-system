export type PagoDivida = {
  contaId: string;
  data: string;
  descricao: string | null;
  dividaId: string;
  id: string;
  transacaoId: string;
  usuarioId: string;
  valor: number;
};

export type CreatePagoDividaRequestDto = {
  categoriaId: string;
  contaId: string;
  data: string;
  descricao?: string;
  dividaId: string;
  valor: number;
};
