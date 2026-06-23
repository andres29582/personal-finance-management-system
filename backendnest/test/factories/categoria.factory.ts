import { TipoCategoria } from '../../src/categorias/enums/tipo-categoria.enum';

type CategoriaPayload = {
  nome: string;
  tipo: TipoCategoria;
  cor: string;
  icone: string;
};

export function makeCategoriaPayload(
  overrides: Partial<CategoriaPayload> = {},
): CategoriaPayload {
  return {
    nome: 'Categoria E2E',
    tipo: TipoCategoria.DESPESA,
    cor: '#dc2626',
    icone: 'receipt',
    ...overrides,
  };
}
