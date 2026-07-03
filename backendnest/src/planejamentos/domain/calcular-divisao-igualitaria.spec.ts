import { calcularDivisaoIgualitaria } from './calcular-divisao-igualitaria';
import { PlanejamentoDominioError } from './types';

describe('calcularDivisaoIgualitaria', () => {
  it('cria divisoes para todos os participantes selecionados', () => {
    const divisoes = calcularDivisaoIgualitaria(9000, [
      'ana',
      'bruno',
      'carla',
    ]);

    expect(divisoes).toEqual([
      { participanteId: 'ana', valorCentavos: 3000 },
      { participanteId: 'bruno', valorCentavos: 3000 },
      { participanteId: 'carla', valorCentavos: 3000 },
    ]);
  });

  it('mantem soma igual ao valor total', () => {
    const divisoes = calcularDivisaoIgualitaria(10000, [
      'ana',
      'bruno',
      'carla',
    ]);

    const soma = divisoes.reduce(
      (total, divisao) => total + divisao.valorCentavos,
      0,
    );

    expect(soma).toBe(10000);
  });

  it('distribui sobra de centavos corretamente', () => {
    expect(
      calcularDivisaoIgualitaria(10001, ['ana', 'bruno', 'carla']),
    ).toEqual([
      { participanteId: 'ana', valorCentavos: 3334 },
      { participanteId: 'bruno', valorCentavos: 3334 },
      { participanteId: 'carla', valorCentavos: 3333 },
    ]);
  });

  it('rejeita participantes duplicados', () => {
    expectErroDominio(
      () => calcularDivisaoIgualitaria(1000, ['ana', 'ana']),
      'PARTICIPANTE_DUPLICADO',
    );
  });

  it('rejeita lista vazia', () => {
    expectErroDominio(
      () => calcularDivisaoIgualitaria(1000, []),
      'PARTICIPANTES_OBRIGATORIOS',
    );
  });

  it('rejeita valor menor que quantidade de participantes', () => {
    expectErroDominio(
      () => calcularDivisaoIgualitaria(1, ['ana', 'bruno', 'carla']),
      'VALOR_MENOR_QUE_PARTICIPANTES',
    );
  });

  function expectErroDominio(acao: () => void, code: string): void {
    try {
      acao();
      throw new Error('Era esperado erro de dominio.');
    } catch (error) {
      if (!(error instanceof PlanejamentoDominioError)) {
        throw error;
      }

      expect(error.code).toBe(code);
    }
  }
});
