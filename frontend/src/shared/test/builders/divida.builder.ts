import { Divida } from '../../../modules/dividas/types/divida';

import { TEST_DATE, TEST_TIMESTAMP } from './constants';

export function makeDivida(overrides: Partial<Divida> = {}): Divida {
  return {
    ativa: true,
    contaId: 'conta1',
    createdAt: TEST_TIMESTAMP,
    cuotaMensual: 500,
    fechaInicio: TEST_DATE,
    fechaVencimiento: '2026-12-01',
    id: 'divida1',
    montoTotal: 5000,
    nome: 'Emprestimo banco',
    periodicidade: 'mensal',
    proximoVencimiento: '2026-06-01',
    tasaInteres: null,
    usuarioId: 'user1',
    ...overrides,
  };
}
