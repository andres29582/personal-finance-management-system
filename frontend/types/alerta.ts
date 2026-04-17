export type TipoAlerta =
  | 'limite_gasto'
  | 'vencimento_divida'
  | 'vencimento_meta';

export type Alerta = {
  ativa: boolean;
  createdAt: string;
  diasAnticipacion: number;
  id: string;
  referenciaId: string;
  tipo: TipoAlerta;
  ultimaNotificacion: string | null;
  usuarioId: string;
};

export type CreateAlertaRequestDto = {
  diasAnticipacion: number;
  referenciaId: string;
  tipo: TipoAlerta;
};

export type UpdateAlertaRequestDto = {
  ativa?: boolean;
  diasAnticipacion?: number;
};
