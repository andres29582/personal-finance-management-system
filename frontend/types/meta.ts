export type TipoMeta = 'economia' | 'reducao_divida';

export type Meta = {
  ativa: boolean;
  contaId: string | null;
  createdAt: string;
  dividaId: string | null;
  fechaLimite: string;
  id: string;
  montoActual: number;
  montoObjetivo: number;
  nome: string;
  tipo: TipoMeta;
  usuarioId: string;
};

export type CreateMetaRequestDto = {
  contaId?: string;
  dividaId?: string;
  fechaLimite: string;
  montoObjetivo: number;
  nome: string;
  tipo: TipoMeta;
};

export type UpdateMetaRequestDto = {
  ativa?: boolean;
  fechaLimite?: string;
  montoActual?: number;
  montoObjetivo?: number;
  nome?: string;
};
