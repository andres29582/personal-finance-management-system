import { Transacao } from '../../../modules/transacoes/types/transacao';

import { TEST_DATE, TEST_TIMESTAMP } from './constants';

export function makeTransacao(
  overrides: Partial<Transacao> = {},
): Transacao {
  return {
    categoriaId: 'cat1',
    contaId: 'conta1',
    createdAt: TEST_TIMESTAMP,
    data: TEST_DATE,
    descricao: 'Compra mercado',
    ehAjuste: false,
    id: 'transacao1',
    tipo: 'despesa',
    updatedAt: TEST_TIMESTAMP,
    usuarioId: 'user1',
    valor: 50,
    ...overrides,
  };
}
