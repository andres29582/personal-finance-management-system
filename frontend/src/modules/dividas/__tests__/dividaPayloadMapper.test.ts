import { buildDividaPayload } from '../mappers/dividaPayloadMapper';

describe('buildDividaPayload', () => {
  const validValues = {
    contaId: 'conta-1',
    cuotaMensual: '450,50',
    fechaInicio: '2026-05-01',
    fechaVencimiento: '2026-12-01',
    montoTotal: '5000,75',
    nome: '  Emprestimo banco  ',
    periodicidade: 'mensal' as const,
    proximoVencimiento: '2026-06-01',
    tasaInteres: '2,5',
  };

  it('builds the current debt API payload shape with normalized values', () => {
    expect(buildDividaPayload(validValues)).toEqual({
      contaId: 'conta-1',
      cuotaMensual: 450.5,
      fechaInicio: '2026-05-01',
      fechaVencimiento: '2026-12-01',
      montoTotal: 5000.75,
      nome: 'Emprestimo banco',
      periodicidade: 'mensal',
      proximoVencimiento: '2026-06-01',
      tasaInteres: 2.5,
    });
  });

  it('preserves optional empty values as undefined like the inline payload', () => {
    expect(
      buildDividaPayload({
        ...validValues,
        contaId: '',
        cuotaMensual: '',
        proximoVencimiento: '',
        tasaInteres: '',
      }),
    ).toEqual({
      contaId: undefined,
      cuotaMensual: undefined,
      fechaInicio: '2026-05-01',
      fechaVencimiento: '2026-12-01',
      montoTotal: 5000.75,
      nome: 'Emprestimo banco',
      periodicidade: 'mensal',
      proximoVencimiento: undefined,
      tasaInteres: undefined,
    });
  });

  it('preserves zero values for optional numeric fields', () => {
    expect(
      buildDividaPayload({
        ...validValues,
        cuotaMensual: '0',
        tasaInteres: '0',
      }),
    ).toMatchObject({
      cuotaMensual: 0,
      tasaInteres: 0,
    });
  });
});
