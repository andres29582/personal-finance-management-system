export type StatusGastoPlanejamento =
  | 'ATIVO'
  | 'CANCELADO'
  | 'PENDENTE_REVISAO';

export type StatusAcertoPlanejamento =
  | 'PENDENTE'
  | 'PAGO'
  | 'CONFIRMADO'
  | 'CANCELADO';

export type StatusFinanceiroParticipante = 'DEVEDOR' | 'RECEBEDOR' | 'QUITADO';

export class PlanejamentoDominioError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = PlanejamentoDominioError.name;
  }
}

export type DivisaoGastoPlanejamento = {
  participanteId: string;
  valorCentavos: number;
};

export type GastoPlanejamentoCalculo = {
  id: string;
  pagoPorParticipanteId: string;
  valorCentavos: number;
  status: StatusGastoPlanejamento;
  divisoes: DivisaoGastoPlanejamento[];
};

export type AcertoPlanejamentoCalculo = {
  devedorParticipanteId: string;
  recebedorParticipanteId: string;
  valorCentavos: number;
  status: StatusAcertoPlanejamento;
};

export type SaldoParticipantePlanejamento = {
  participanteId: string;
  totalPagoCentavos: number;
  totalDevidoCentavos: number;
  totalPagoEmAcertosCentavos: number;
  totalRecebidoEmAcertosCentavos: number;
  saldoBrutoCentavos: number;
  saldoAbertoCentavos: number;
  statusFinanceiro: StatusFinanceiroParticipante;
};

export type AcertoMinimoPlanejamento = {
  devedorParticipanteId: string;
  recebedorParticipanteId: string;
  valorCentavos: number;
};

export function assertInteiroCentavos(
  valorCentavos: number,
  campo = 'Valor',
): void {
  if (!Number.isInteger(valorCentavos)) {
    throw new PlanejamentoDominioError(
      'VALOR_CENTAVOS_INVALIDO',
      `${campo} deve ser um inteiro em centavos.`,
    );
  }
}

export function assertValorPositivoCentavos(
  valorCentavos: number,
  campo = 'Valor',
): void {
  assertInteiroCentavos(valorCentavos, campo);

  if (valorCentavos <= 0) {
    throw new PlanejamentoDominioError(
      'VALOR_CENTAVOS_DEVE_SER_POSITIVO',
      `${campo} deve ser maior que zero.`,
    );
  }
}
