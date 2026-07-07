export type PlanejamentoTipo =
  | 'CASA'
  | 'FESTA'
  | 'VIAGEM'
  | 'EVENTO'
  | 'GRUPO'
  | 'OUTRO';

export type PlanejamentoStatus =
  | 'ABERTO'
  | 'FECHADO'
  | 'ARQUIVADO'
  | 'CANCELADO';

export type ParticipantePlanejamentoTipo = 'MANUAL' | 'CONVIDADO' | 'VINCULADO';
export type ParticipantePlanejamentoStatus = 'ATIVO' | 'PENDENTE' | 'REMOVIDO';
export type GastoPlanejamentoComportamento = 'FIXO' | 'VARIAVEL' | 'EVENTUAL';
export type GastoPlanejamentoStatus = 'ATIVO' | 'CANCELADO' | 'PENDENTE_REVISAO';
export type DivisaoGastoPlanejamentoStatus = 'ATIVA' | 'CANCELADA';
export type AcertoPlanejamentoStatus =
  | 'PENDENTE'
  | 'PAGO'
  | 'CANCELADO'
  | 'CONFIRMADO';

export type ParticipantePlanejamento = {
  createdAt: string;
  email: string | null;
  id: string;
  nome: string;
  planejamentoId: string;
  status: ParticipantePlanejamentoStatus;
  tipo: ParticipantePlanejamentoTipo;
  updatedAt: string;
  usuarioId: string | null;
};

export type DivisaoGastoPlanejamento = {
  createdAt: string;
  gastoId: string;
  id: string;
  participante?: ParticipantePlanejamento;
  participanteId: string;
  status: DivisaoGastoPlanejamentoStatus;
  updatedAt: string;
  valorDevidoCentavos: number;
};

export type GastoPlanejamento = {
  categoria: string | null;
  comportamento: GastoPlanejamentoComportamento;
  comprovanteNome: string | null;
  comprovanteUrl: string | null;
  createdAt: string;
  dataGasto: string;
  deletedAt: string | null;
  descricao: string;
  divisoes?: DivisaoGastoPlanejamento[];
  id: string;
  mesReferencia: string | null;
  observacao: string | null;
  pagoPorParticipante?: ParticipantePlanejamento;
  pagoPorParticipanteId: string;
  planejamentoId: string;
  requerRevisaoMensal: boolean;
  status: GastoPlanejamentoStatus;
  ultimaAlteracaoValorEm: string | null;
  updatedAt: string;
  valorCentavos: number;
};

export type AcertoPlanejamento = {
  createdAt: string;
  dataPagamento: string | null;
  deParticipante?: ParticipantePlanejamento;
  deParticipanteId: string;
  id: string;
  observacao: string | null;
  paraParticipante?: ParticipantePlanejamento;
  paraParticipanteId: string;
  planejamentoId: string;
  status: AcertoPlanejamentoStatus;
  updatedAt: string;
  valorCentavos: number;
};

export type Planejamento = {
  acertos?: AcertoPlanejamento[];
  createdAt: string;
  dataFim: string | null;
  dataInicio: string | null;
  deletedAt: string | null;
  descricao: string | null;
  gastos?: GastoPlanejamento[];
  id: string;
  nome: string;
  participantes?: ParticipantePlanejamento[];
  status: PlanejamentoStatus;
  tipo: PlanejamentoTipo;
  updatedAt: string;
  usuarioCriadorId: string;
};

export type CreatePlanejamentoRequest = {
  dataFim?: string;
  dataInicio?: string;
  descricao?: string;
  nome: string;
  tipo: PlanejamentoTipo;
};

export type SuccessEnvelope<T> = {
  data: T;
  requestId: string;
  success: true;
  timestamp: string;
};

export type PlanejamentoListSuccess = SuccessEnvelope<Planejamento[]>;
export type PlanejamentoSuccess = SuccessEnvelope<Planejamento>;
