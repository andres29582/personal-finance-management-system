import { distribuirCentavos } from './distribuir-centavos';
import { PlanejamentoDominioError } from './types';

describe('distribuirCentavos', () => {
  it('divide 10000 centavos entre 3 participantes como 3334, 3333, 3333', () => {
    expect(distribuirCentavos(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  it('divide 30000 centavos entre 4 participantes igualmente', () => {
    expect(distribuirCentavos(30000, 4)).toEqual([7500, 7500, 7500, 7500]);
  });

  it('rejeita valor zero', () => {
    expectErroDominio(
      () => distribuirCentavos(0, 3),
      'VALOR_CENTAVOS_DEVE_SER_POSITIVO',
    );
  });

  it('rejeita quantidade zero', () => {
    expectErroDominio(
      () => distribuirCentavos(100, 0),
      'PARTICIPANTES_OBRIGATORIOS',
    );
  });

  it('rejeita valor menor que quantidade de participantes', () => {
    expectErroDominio(
      () => distribuirCentavos(2, 3),
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
