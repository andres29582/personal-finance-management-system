import {
  AcertoPlanejamentoCalculo,
  GastoPlanejamentoCalculo,
  PlanejamentoDominioError,
  SaldoParticipantePlanejamento,
  StatusFinanceiroParticipante,
  assertValorPositivoCentavos,
} from './types';

export function calcularSaldosParticipantes(
  participantesIds: string[],
  gastos: GastoPlanejamentoCalculo[],
  acertos: AcertoPlanejamentoCalculo[] = [],
): SaldoParticipantePlanejamento[] {
  validarParticipantes(participantesIds);

  const saldos = inicializarSaldos(participantesIds);

  for (const gasto of gastos) {
    if (gasto.status !== 'ATIVO') {
      continue;
    }

    assertValorPositivoCentavos(gasto.valorCentavos, 'Valor do gasto');
    validarParticipanteConhecido(
      gasto.pagoPorParticipanteId,
      saldos,
      'Pagador do gasto nao pertence aos participantes informados.',
    );

    saldos.get(gasto.pagoPorParticipanteId)!.totalPagoCentavos +=
      gasto.valorCentavos;

    for (const divisao of gasto.divisoes) {
      assertValorPositivoCentavos(divisao.valorCentavos, 'Valor da divisao');
      validarParticipanteConhecido(
        divisao.participanteId,
        saldos,
        'Participante da divisao nao pertence aos participantes informados.',
      );

      saldos.get(divisao.participanteId)!.totalDevidoCentavos +=
        divisao.valorCentavos;
    }
  }

  for (const acerto of acertos) {
    if (acerto.status === 'CANCELADO' || acerto.status === 'PENDENTE') {
      continue;
    }

    if (acerto.status !== 'PAGO' && acerto.status !== 'CONFIRMADO') {
      continue;
    }

    assertValorPositivoCentavos(acerto.valorCentavos, 'Valor do acerto');
    validarParticipanteConhecido(
      acerto.devedorParticipanteId,
      saldos,
      'Devedor do acerto nao pertence aos participantes informados.',
    );
    validarParticipanteConhecido(
      acerto.recebedorParticipanteId,
      saldos,
      'Recebedor do acerto nao pertence aos participantes informados.',
    );

    saldos.get(acerto.devedorParticipanteId)!.totalPagoEmAcertosCentavos +=
      acerto.valorCentavos;
    saldos.get(
      acerto.recebedorParticipanteId,
    )!.totalRecebidoEmAcertosCentavos += acerto.valorCentavos;
  }

  return participantesIds.map((participanteId) => {
    const saldo = saldos.get(participanteId)!;
    const saldoBrutoCentavos =
      saldo.totalPagoCentavos - saldo.totalDevidoCentavos;
    const saldoAbertoCentavos =
      saldoBrutoCentavos +
      saldo.totalPagoEmAcertosCentavos -
      saldo.totalRecebidoEmAcertosCentavos;

    return {
      participanteId,
      totalPagoCentavos: saldo.totalPagoCentavos,
      totalDevidoCentavos: saldo.totalDevidoCentavos,
      totalPagoEmAcertosCentavos: saldo.totalPagoEmAcertosCentavos,
      totalRecebidoEmAcertosCentavos: saldo.totalRecebidoEmAcertosCentavos,
      saldoBrutoCentavos,
      saldoAbertoCentavos,
      statusFinanceiro: resolverStatusFinanceiro(saldoAbertoCentavos),
    };
  });
}

type SaldoMutavel = Omit<
  SaldoParticipantePlanejamento,
  'saldoBrutoCentavos' | 'saldoAbertoCentavos' | 'statusFinanceiro'
>;

function inicializarSaldos(
  participantesIds: string[],
): Map<string, SaldoMutavel> {
  return new Map(
    participantesIds.map((participanteId) => [
      participanteId,
      {
        participanteId,
        totalPagoCentavos: 0,
        totalDevidoCentavos: 0,
        totalPagoEmAcertosCentavos: 0,
        totalRecebidoEmAcertosCentavos: 0,
      },
    ]),
  );
}

function validarParticipantes(participantesIds: string[]): void {
  if (participantesIds.length === 0) {
    throw new PlanejamentoDominioError(
      'PARTICIPANTES_OBRIGATORIOS',
      'Lista de participantes nao pode estar vazia.',
    );
  }

  if (new Set(participantesIds).size !== participantesIds.length) {
    throw new PlanejamentoDominioError(
      'PARTICIPANTE_DUPLICADO',
      'Participante duplicado.',
    );
  }
}

function validarParticipanteConhecido(
  participanteId: string,
  saldos: Map<string, SaldoMutavel>,
  message: string,
): void {
  if (!saldos.has(participanteId)) {
    throw new PlanejamentoDominioError('PARTICIPANTE_INVALIDO', message);
  }
}

function resolverStatusFinanceiro(
  saldoCentavos: number,
): StatusFinanceiroParticipante {
  if (saldoCentavos > 0) {
    return 'RECEBEDOR';
  }

  if (saldoCentavos < 0) {
    return 'DEVEDOR';
  }

  return 'QUITADO';
}
