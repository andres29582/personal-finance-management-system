import { Conta } from '../../../modules/contas/types/conta';

import { TEST_TIMESTAMP } from './constants';

export function makeConta(overrides: Partial<Conta> = {}): Conta {
  return {
    ativa: true,
    createdAt: TEST_TIMESTAMP,
    dataCorte: null,
    dataPagamento: null,
    id: 'conta1',
    limiteCredito: null,
    moeda: 'BRL',
    nome: 'Conta Corrente',
    saldoAtual: 1000,
    saldoInicial: 1000,
    tipo: 'banco',
    updatedAt: TEST_TIMESTAMP,
    usuarioId: 'user1',
    ...overrides,
  };
}
