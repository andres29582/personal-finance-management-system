import { calcularAcertosMinimos } from './calcular-acertos-minimos';
import { calcularDivisaoIgualitaria } from './calcular-divisao-igualitaria';
import { AcertoPlanejamentoCalculo, GastoPlanejamentoCalculo } from './types';

describe('calcularAcertosMinimos', () => {
  it('calcula acerto simples entre um devedor e um recebedor', () => {
    const participantes = ['ana', 'bruno'];
    const gastos: GastoPlanejamentoCalculo[] = [
      {
        id: 'gasto-1',
        pagoPorParticipanteId: 'ana',
        valorCentavos: 10000,
        status: 'ATIVO',
        divisoes: calcularDivisaoIgualitaria(10000, participantes),
      },
    ];

    expect(calcularAcertosMinimos(participantes, gastos)).toEqual([
      {
        devedorParticipanteId: 'bruno',
        recebedorParticipanteId: 'ana',
        valorCentavos: 5000,
      },
    ]);
  });

  it('calcula acertos minimos entre multiplos devedores e recebedores', () => {
    const participantes = ['andres', 'maria', 'joao', 'pedro'];
    const gastos = criarGastosExemplo(participantes);

    expect(calcularAcertosMinimos(participantes, gastos)).toEqual([
      {
        devedorParticipanteId: 'joao',
        recebedorParticipanteId: 'andres',
        valorCentavos: 5000,
      },
      {
        devedorParticipanteId: 'pedro',
        recebedorParticipanteId: 'maria',
        valorCentavos: 25000,
      },
    ]);
  });

  it('nao gera acerto para participante quitado', () => {
    expect(calcularAcertosMinimos(['ana', 'bruno'], [])).toEqual([]);
  });

  it('nao gera acerto com valor zero', () => {
    const participantes = ['ana', 'bruno'];
    const gastos: GastoPlanejamentoCalculo[] = [
      {
        id: 'gasto-1',
        pagoPorParticipanteId: 'ana',
        valorCentavos: 5000,
        status: 'ATIVO',
        divisoes: [{ participanteId: 'ana', valorCentavos: 5000 }],
      },
      {
        id: 'gasto-2',
        pagoPorParticipanteId: 'bruno',
        valorCentavos: 5000,
        status: 'ATIVO',
        divisoes: [{ participanteId: 'bruno', valorCentavos: 5000 }],
      },
    ];

    expect(calcularAcertosMinimos(participantes, gastos)).toEqual([]);
  });

  it('considera acertos pagos e gera apenas pendencias restantes', () => {
    const participantes = ['andres', 'maria', 'joao', 'pedro'];
    const gastos = criarGastosExemplo(participantes);
    const acertos: AcertoPlanejamentoCalculo[] = [
      {
        devedorParticipanteId: 'joao',
        recebedorParticipanteId: 'andres',
        valorCentavos: 5000,
        status: 'PAGO',
      },
    ];

    expect(calcularAcertosMinimos(participantes, gastos, acertos)).toEqual([
      {
        devedorParticipanteId: 'pedro',
        recebedorParticipanteId: 'maria',
        valorCentavos: 25000,
      },
    ]);
  });

  it('considera acertos confirmados e gera apenas pendencias restantes', () => {
    const participantes = ['andres', 'maria', 'joao', 'pedro'];
    const gastos = criarGastosExemplo(participantes);
    const acertos: AcertoPlanejamentoCalculo[] = [
      {
        devedorParticipanteId: 'joao',
        recebedorParticipanteId: 'andres',
        valorCentavos: 5000,
        status: 'CONFIRMADO',
      },
    ];

    expect(calcularAcertosMinimos(participantes, gastos, acertos)).toEqual([
      {
        devedorParticipanteId: 'pedro',
        recebedorParticipanteId: 'maria',
        valorCentavos: 25000,
      },
    ]);
  });

  it('ignora acertos cancelados', () => {
    const participantes = ['andres', 'maria', 'joao', 'pedro'];
    const gastos = criarGastosExemplo(participantes);
    const acertos: AcertoPlanejamentoCalculo[] = [
      {
        devedorParticipanteId: 'joao',
        recebedorParticipanteId: 'andres',
        valorCentavos: 5000,
        status: 'CANCELADO',
      },
    ];

    expect(calcularAcertosMinimos(participantes, gastos, acertos)).toEqual([
      {
        devedorParticipanteId: 'joao',
        recebedorParticipanteId: 'andres',
        valorCentavos: 5000,
      },
      {
        devedorParticipanteId: 'pedro',
        recebedorParticipanteId: 'maria',
        valorCentavos: 25000,
      },
    ]);
  });

  function criarGastosExemplo(
    participantes: string[],
  ): GastoPlanejamentoCalculo[] {
    return [
      criarGasto('bebidas', 'andres', 30000, participantes),
      criarGasto('comida', 'maria', 50000, participantes),
      criarGasto('decoracao', 'joao', 20000, participantes),
    ];
  }

  function criarGasto(
    id: string,
    pagoPorParticipanteId: string,
    valorCentavos: number,
    participantes: string[],
  ): GastoPlanejamentoCalculo {
    return {
      id,
      pagoPorParticipanteId,
      valorCentavos,
      status: 'ATIVO',
      divisoes: calcularDivisaoIgualitaria(valorCentavos, participantes),
    };
  }
});
