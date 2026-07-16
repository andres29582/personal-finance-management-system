import { calcularSaldosParticipantes } from './calcular-saldos-participantes';
import { calcularResumoFinanceiroPlanejamento } from './calcular-resumo-financeiro';
import { AcertoPlanejamentoCalculo, GastoPlanejamentoCalculo } from './types';

describe('calcularResumoFinanceiroPlanejamento', () => {
  const participantesIds = ['participante-1', 'participante-2'];

  function criarGasto(
    overrides: Partial<GastoPlanejamentoCalculo> = {},
  ): GastoPlanejamentoCalculo {
    return {
      id: 'gasto-1',
      pagoPorParticipanteId: 'participante-1',
      valorCentavos: 10001,
      status: 'ATIVO',
      divisoes: [
        { participanteId: 'participante-1', valorCentavos: 5001 },
        { participanteId: 'participante-2', valorCentavos: 5000 },
      ],
      ...overrides,
    };
  }

  function criarAcerto(
    overrides: Partial<AcertoPlanejamentoCalculo> = {},
  ): AcertoPlanejamentoCalculo {
    return {
      devedorParticipanteId: 'participante-2',
      recebedorParticipanteId: 'participante-1',
      valorCentavos: 5000,
      status: 'PAGO',
      ...overrides,
    };
  }

  it('retorna QUITADO quando nao existe pendencia financeira', () => {
    expect(calcularResumoFinanceiroPlanejamento(participantesIds, [])).toEqual(
      expect.objectContaining({
        situacaoFinanceira: 'QUITADO',
        obrigacaoResidualCentavos: 0,
        totalGastosAtivosCentavos: 0,
      }),
    );
  });

  it('retorna PENDENTE para gasto ativo nao liquidado', () => {
    expect(
      calcularResumoFinanceiroPlanejamento(participantesIds, [criarGasto()]),
    ).toEqual(
      expect.objectContaining({
        situacaoFinanceira: 'PENDENTE',
        obrigacaoResidualCentavos: 5000,
        totalGastosAtivosCentavos: 10001,
      }),
    );
  });

  it('mantem PENDENTE depois de pagamento parcial', () => {
    const resumo = calcularResumoFinanceiroPlanejamento(
      participantesIds,
      [criarGasto()],
      [criarAcerto({ valorCentavos: 2000 })],
    );

    expect(resumo).toEqual(
      expect.objectContaining({
        situacaoFinanceira: 'PENDENTE',
        obrigacaoResidualCentavos: 3000,
      }),
    );
  });

  it('retorna QUITADO depois de pagamento total', () => {
    expect(
      calcularResumoFinanceiroPlanejamento(
        participantesIds,
        [criarGasto()],
        [criarAcerto()],
      ).situacaoFinanceira,
    ).toBe('QUITADO');
  });

  it('considera acerto CONFIRMADO efetivo', () => {
    const resumo = calcularResumoFinanceiroPlanejamento(
      participantesIds,
      [criarGasto()],
      [criarAcerto({ status: 'CONFIRMADO' })],
    );

    expect(resumo.obrigacaoResidualCentavos).toBe(0);
    expect(resumo.situacaoFinanceira).toBe('QUITADO');
  });

  it('nao reduz a obrigacao com acerto CANCELADO', () => {
    expect(
      calcularResumoFinanceiroPlanejamento(
        participantesIds,
        [criarGasto()],
        [criarAcerto({ status: 'CANCELADO' })],
      ).obrigacaoResidualCentavos,
    ).toBe(5000);
  });

  it('nao reduz a obrigacao com acerto PENDENTE', () => {
    expect(
      calcularResumoFinanceiroPlanejamento(
        participantesIds,
        [criarGasto()],
        [criarAcerto({ status: 'PENDENTE' })],
      ).obrigacaoResidualCentavos,
    ).toBe(5000);
  });

  it('ignora gasto CANCELADO', () => {
    const resumo = calcularResumoFinanceiroPlanejamento(participantesIds, [
      criarGasto({ status: 'CANCELADO' }),
    ]);

    expect(resumo).toEqual(
      expect.objectContaining({
        situacaoFinanceira: 'QUITADO',
        totalGastosAtivosCentavos: 0,
      }),
    );
  });

  it('ignora gasto PENDENTE_REVISAO', () => {
    const resumo = calcularResumoFinanceiroPlanejamento(participantesIds, [
      criarGasto({ status: 'PENDENTE_REVISAO' }),
    ]);

    expect(resumo).toEqual(
      expect.objectContaining({
        situacaoFinanceira: 'QUITADO',
        totalGastosAtivosCentavos: 0,
      }),
    );
  });

  it('conta a obrigacao residual somente pelo lado credor', () => {
    const resumo = calcularResumoFinanceiroPlanejamento(participantesIds, [
      criarGasto(),
    ]);
    const somaAbsoluta = resumo.participantes.reduce(
      (total, participante) =>
        total + Math.abs(participante.saldoAbertoCentavos),
      0,
    );

    expect(resumo.obrigacaoResidualCentavos).toBe(5000);
    expect(somaAbsoluta).toBe(10000);
  });

  it('mantem todos os totais monetarios inteiros', () => {
    const resumo = calcularResumoFinanceiroPlanejamento(participantesIds, [
      criarGasto(),
    ]);
    const valores = [
      resumo.totalGastosAtivosCentavos,
      resumo.obrigacaoResidualCentavos,
      ...resumo.participantes.flatMap((participante) => [
        participante.totalPagoCentavos,
        participante.totalDevidoCentavos,
        participante.totalPagoEmAcertosCentavos,
        participante.totalRecebidoEmAcertosCentavos,
        participante.saldoBrutoCentavos,
        participante.saldoAbertoCentavos,
      ]),
    ];

    expect(valores.every(Number.isInteger)).toBe(true);
  });

  it('preserva a ordem e os mesmos saldos de calcularSaldosParticipantes', () => {
    const gastos = [criarGasto()];
    const acertos = [criarAcerto({ valorCentavos: 2000 })];
    const resumo = calcularResumoFinanceiroPlanejamento(
      participantesIds,
      gastos,
      acertos,
    );

    expect(resumo.participantes).toEqual(
      calcularSaldosParticipantes(participantesIds, gastos, acertos),
    );
    expect(
      resumo.participantes.map(({ participanteId }) => participanteId),
    ).toEqual(participantesIds);
  });
});
