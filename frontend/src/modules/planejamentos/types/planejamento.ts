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
export type PlanejamentoSituacaoFinanceira = 'PENDENTE' | 'QUITADO';
export type ParticipantePlanejamentoStatusFinanceiro =
  | 'DEVEDOR'
  | 'RECEBEDOR'
  | 'QUITADO';

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
  dataPagamento: string | null;
  deParticipante: ParticipanteAcertoPlanejamento;
  deParticipanteId: string;
  id: string;
  observacao: string | null;
  paraParticipante: ParticipanteAcertoPlanejamento;
  paraParticipanteId: string;
  status: AcertoPlanejamentoStatus;
  valorCentavos: number;
};

export type ParticipanteAcertoPlanejamento = {
  id: string;
  nome: string;
};

export type ParticipanteResumoFinanceiroPlanejamento = Pick<
  ParticipantePlanejamento,
  'id' | 'nome' | 'status' | 'tipo'
>;

export type SaldoParticipanteResumoFinanceiroPlanejamento = {
  participante: ParticipanteResumoFinanceiroPlanejamento;
  saldoAbertoCentavos: number;
  saldoBrutoCentavos: number;
  statusFinanceiro: ParticipantePlanejamentoStatusFinanceiro;
  totalDevidoCentavos: number;
  totalPagoCentavos: number;
  totalPagoEmAcertosCentavos: number;
  totalRecebidoEmAcertosCentavos: number;
};

export type ResumoFinanceiroPlanejamento = {
  obrigacaoResidualCentavos: number;
  participantes: SaldoParticipanteResumoFinanceiroPlanejamento[];
  planejamentoId: string;
  situacaoFinanceira: PlanejamentoSituacaoFinanceira;
  statusOperacional: PlanejamentoStatus;
  totalGastosAtivosCentavos: number;
};

export type Planejamento = {
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

export type AddParticipantePlanejamentoRequest = {
  email?: string;
  nome: string;
  usuarioId?: string;
};

export type CreateGastoPlanejamentoRequest = {
  categoria?: string;
  comportamento: GastoPlanejamentoComportamento;
  dataGasto: string;
  descricao: string;
  mesReferencia?: string;
  observacao?: string;
  pagoPorParticipanteId: string;
  participantesIds: string[];
  valorCentavos: number;
};

export type SuccessEnvelope<T> = {
  data: T;
  requestId: string;
  success: true;
  timestamp: string;
};

export type PlanejamentoListSuccess = SuccessEnvelope<Planejamento[]>;
export type PlanejamentoSuccess = SuccessEnvelope<Planejamento>;
export type ParticipantePlanejamentoSuccess =
  SuccessEnvelope<ParticipantePlanejamento>;
export type GastoPlanejamentoSuccess = SuccessEnvelope<GastoPlanejamento>;
export type GastoPlanejamentoListSuccess =
  SuccessEnvelope<GastoPlanejamento[]>;
export type AcertoPlanejamentoSuccess = SuccessEnvelope<AcertoPlanejamento>;
export type AcertoPlanejamentoListSuccess =
  SuccessEnvelope<AcertoPlanejamento[]>;
export type ResumoFinanceiroPlanejamentoSuccess =
  SuccessEnvelope<ResumoFinanceiroPlanejamento>;
