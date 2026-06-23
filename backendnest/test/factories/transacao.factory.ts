import { TipoTransacao } from '../../src/transacoes/enums/tipo-transacao.enum';

type TransacaoPayload = {
  contaId: string;
  categoriaId: string;
  tipo: TipoTransacao;
  valor: number;
  data: string;
  descricao: string;
};

export function makeTransacaoPayload(
  overrides: Partial<TransacaoPayload> = {},
): TransacaoPayload {
  return {
    contaId: 'conta-e2e',
    categoriaId: 'categoria-e2e',
    tipo: TipoTransacao.DESPESA,
    valor: 100,
    data: '2026-05-01',
    descricao: 'Transacao E2E',
    ...overrides,
  };
}
