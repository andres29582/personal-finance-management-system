export type Periodicidade = 'anual' | 'mensal' | 'quinzenal' | 'semanal';

export type Divida = {
  ativa: boolean;
  contaId: string | null;
  createdAt: string;
  cuotaMensual: number | null;
  fechaInicio: string;
  fechaVencimiento: string;
  id: string;
  montoTotal: number;
  nome: string;
  periodicidade: Periodicidade | null;
  proximoVencimiento: string | null;
  tasaInteres: number | null;
  usuarioId: string;
};

export type CreateDividaRequestDto = {
  contaId?: string;
  cuotaMensual?: number;
  fechaInicio: string;
  fechaVencimiento: string;
  montoTotal: number;
  nome: string;
  periodicidade?: Periodicidade;
  proximoVencimiento?: string;
  tasaInteres?: number;
};

export type UpdateDividaRequestDto = {
  ativa?: boolean;
  cuotaMensual?: number;
  fechaVencimiento?: string;
  nome?: string;
  periodicidade?: Periodicidade;
  proximoVencimiento?: string;
  tasaInteres?: number;
};
