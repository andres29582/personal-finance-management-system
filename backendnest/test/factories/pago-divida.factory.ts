type PagoDividaPayload = {
  dividaId: string;
  contaId: string;
  categoriaId: string;
  valor: number;
  data: string;
  descricao: string;
};

export function makePagoDividaPayload(
  overrides: Partial<PagoDividaPayload> = {},
): PagoDividaPayload {
  return {
    dividaId: 'divida-e2e',
    contaId: 'conta-e2e',
    categoriaId: 'categoria-e2e',
    valor: 100,
    data: '2026-05-05',
    descricao: 'Pagamento de divida E2E',
    ...overrides,
  };
}
