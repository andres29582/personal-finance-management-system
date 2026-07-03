import { calcularDivisaoIgualitaria } from './calcular-divisao-igualitaria';
import { calcularSaldosParticipantes } from './calcular-saldos-participantes';
import { AcertoPlanejamentoCalculo, GastoPlanejamentoCalculo } from './types';

describe('calcularSaldosParticipantes', () => {
  const participantes = ['andres', 'maria', 'joao', 'pedro'];

  it('calcula total pago, total devido e saldos por participante', () => {
    const saldos = calcularSaldosParticipantes(
      participantes,
      criarGastosExemplo(),
    );

    expect(saldos).toEqual([
      expect.objectContaining({
        participanteId: 'andres',
        totalPagoCentavos: 30000,
        totalDevidoCentavos: 25000,
        saldoBrutoCentavos: 5000,
        saldoAbertoCentavos: 5000,
        statusFinanceiro: 'RECEBEDOR',
      }),
      expect.objectContaining({
        participanteId: 'maria',
        totalPagoCentavos: 50000,
        totalDevidoCentavos: 25000,
        saldoBrutoCentavos: 25000,
        saldoAbertoCentavos: 25000,
        statusFinanceiro: 'RECEBEDOR',
      }),
      expect.objectContaining({
        participanteId: 'joao',
        totalPagoCentavos: 20000,
        totalDevidoCentavos: 25000,
        saldoBrutoCentavos: -5000,
        saldoAbertoCentavos: -5000,
        statusFinanceiro: 'DEVEDOR',
      }),
      expect.objectContaining({
        participanteId: 'pedro',
        totalPagoCentavos: 0,
        totalDevidoCentavos: 25000,
        saldoBrutoCentavos: -25000,
        saldoAbertoCentavos: -25000,
        statusFinanceiro: 'DEVEDOR',
      }),
    ]);
  });

  it('ignora gastos cancelados', () => {
    const saldos = calcularSaldosParticipantes(participantes, [
      criarGasto('cancelado', 'andres', 12000, 'CANCELADO'),
    ]);

    for (const participanteId of participantes) {
      expect(saldos).toContainEqual(
        expect.objectContaining({
          participanteId,
          totalPagoCentavos: 0,
          totalDevidoCentavos: 0,
          saldoAbertoCentavos: 0,
          statusFinanceiro: 'QUITADO',
        }),
      );
    }
  });

  it('ignora gastos pendentes de revisao nos acertos oficiais', () => {
    const saldos = calcularSaldosParticipantes(participantes, [
      criarGasto('luz', 'maria', 12000, 'PENDENTE_REVISAO'),
    ]);

    expect(saldos.every((saldo) => saldo.saldoAbertoCentavos === 0)).toBe(true);
  });

  it('considera acertos pagos no saldo aberto restante', () => {
    const acertos: AcertoPlanejamentoCalculo[] = [
      {
        devedorParticipanteId: 'joao',
        recebedorParticipanteId: 'andres',
        valorCentavos: 5000,
        status: 'PAGO',
      },
    ];

    const saldos = calcularSaldosParticipantes(
      participantes,
      criarGastosExemplo(),
      acertos,
    );

    expect(saldos).toEqual([
      expect.objectContaining({
        participanteId: 'andres',
        saldoBrutoCentavos: 5000,
        saldoAbertoCentavos: 0,
        totalRecebidoEmAcertosCentavos: 5000,
        statusFinanceiro: 'QUITADO',
      }),
      expect.objectContaining({
        participanteId: 'maria',
        saldoAbertoCentavos: 25000,
        statusFinanceiro: 'RECEBEDOR',
      }),
      expect.objectContaining({
        participanteId: 'joao',
        saldoBrutoCentavos: -5000,
        saldoAbertoCentavos: 0,
        totalPagoEmAcertosCentavos: 5000,
        statusFinanceiro: 'QUITADO',
      }),
      expect.objectContaining({
        participanteId: 'pedro',
        saldoAbertoCentavos: -25000,
        statusFinanceiro: 'DEVEDOR',
      }),
    ]);
  });

  function criarGastosExemplo(): GastoPlanejamentoCalculo[] {
    return [
      criarGasto('bebidas', 'andres', 30000),
      criarGasto('comida', 'maria', 50000),
      criarGasto('decoracao', 'joao', 20000),
    ];
  }

  function criarGasto(
    id: string,
    pagoPorParticipanteId: string,
    valorCentavos: number,
    status: GastoPlanejamentoCalculo['status'] = 'ATIVO',
  ): GastoPlanejamentoCalculo {
    return {
      id,
      pagoPorParticipanteId,
      valorCentavos,
      status,
      divisoes: calcularDivisaoIgualitaria(valorCentavos, participantes),
    };
  }
});
