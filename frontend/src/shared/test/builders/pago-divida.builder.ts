import { PagoDivida } from '../../../../types/pago-divida';

import { TEST_DATE } from './constants';

export function makePagoDivida(
  overrides: Partial<PagoDivida> = {},
): PagoDivida {
  return {
    contaId: 'conta1',
    data: TEST_DATE,
    descricao: 'Pagamento da divida',
    dividaId: 'divida1',
    id: 'pago1',
    transacaoId: 'transacao1',
    usuarioId: 'user1',
    valor: 500,
    ...overrides,
  };
}
