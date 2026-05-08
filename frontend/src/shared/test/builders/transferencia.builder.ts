import { Transferencia } from '../../../../types/transferencia';

import { TEST_DATE, TEST_TIMESTAMP } from './constants';

export function makeTransferencia(
  overrides: Partial<Transferencia> = {},
): Transferencia {
  return {
    comissao: 0,
    contaDestinoId: 'conta2',
    contaOrigemId: 'conta1',
    createdAt: TEST_TIMESTAMP,
    data: TEST_DATE,
    descricao: 'Transferencia entre contas',
    id: 'transferencia1',
    moeda: 'BRL',
    updatedAt: TEST_TIMESTAMP,
    usuarioId: 'user1',
    valor: 200,
    ...overrides,
  };
}
