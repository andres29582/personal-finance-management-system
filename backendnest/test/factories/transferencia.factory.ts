type TransferenciaPayload = {
  contaOrigemId: string;
  contaDestinoId: string;
  valor: number;
  comissao: number;
  data: string;
  descricao?: string;
};

export function makeTransferenciaPayload(
  overrides: Partial<TransferenciaPayload> = {},
): TransferenciaPayload {
  return {
    contaOrigemId: 'conta-origem-e2e',
    contaDestinoId: 'conta-destino-e2e',
    valor: 200,
    comissao: 0,
    data: '2026-05-04',
    descricao: 'Transferencia E2E',
    ...overrides,
  };
}
