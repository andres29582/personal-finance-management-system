export type TipoCategoria = 'despesa' | 'receita';

export type Categoria = {
  ativa: boolean;
  cor: string | null;
  createdAt: string;
  icone: string | null;
  id: string;
  nome: string;
  tipo: TipoCategoria;
  usuarioId: string;
};

export type CreateCategoriaRequestDto = {
  cor?: string;
  icone?: string;
  nome: string;
  tipo: TipoCategoria;
};

export type UpdateCategoriaRequestDto = {
  ativa?: boolean;
  cor?: string;
  icone?: string;
  nome?: string;
  tipo?: TipoCategoria;
};
