import { Categoria } from '../../../modules/categorias/types/categoria';

import { TEST_TIMESTAMP } from './constants';

export function makeCategoria(
  overrides: Partial<Categoria> = {},
): Categoria {
  return {
    ativa: true,
    cor: '#2F80ED',
    createdAt: TEST_TIMESTAMP,
    icone: 'tag',
    id: 'cat1',
    nome: 'Alimentacao',
    tipo: 'despesa',
    usuarioId: 'user1',
    ...overrides,
  };
}
