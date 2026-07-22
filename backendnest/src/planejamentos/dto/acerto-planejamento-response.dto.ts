import { AcertoStatus } from '../enums';

export type ParticipanteAcertoResponse = {
  id: string;
  nome: string;
};

export type AcertoPlanejamentoResponse = {
  id: string;
  deParticipanteId: string;
  paraParticipanteId: string;
  valorCentavos: number;
  status: AcertoStatus;
  dataPagamento: Date | null;
  observacao: string | null;
  deParticipante: ParticipanteAcertoResponse;
  paraParticipante: ParticipanteAcertoResponse;
};
