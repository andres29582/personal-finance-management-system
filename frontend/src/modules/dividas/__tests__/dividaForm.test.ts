import { validateDividaForm } from '../validators/dividaForm';

describe('validateDividaForm', () => {
  const validValues = {
    cuotaMensual: '',
    fechaInicio: '2026-05-01',
    fechaVencimiento: '2026-12-01',
    montoTotal: '5000',
    nome: 'Emprestimo banco',
    proximoVencimiento: '',
    tasaInteres: '',
  };

  it('returns no field errors for valid required values', () => {
    expect(validateDividaForm(validValues)).toEqual({});
  });

  it('preserves required field validation messages', () => {
    expect(
      validateDividaForm({
        ...validValues,
        fechaInicio: '',
        fechaVencimiento: '',
        montoTotal: '',
        nome: '',
      }),
    ).toEqual({
      fechaInicio: 'Informe a data de inicio.',
      fechaVencimiento: 'Informe a data de vencimento.',
      montoTotal: 'Informe um valor total valido maior que zero.',
      nome: 'Informe um nome para a divida.',
    });
  });

  it('validates date formats and chronological order', () => {
    expect(
      validateDividaForm({
        ...validValues,
        fechaInicio: '2026-05-01',
        fechaVencimiento: '2026-04-30',
        proximoVencimiento: '30/05/2026',
      }),
    ).toEqual({
      fechaVencimiento:
        'A data de vencimento deve ser igual ou posterior a data de inicio.',
      proximoVencimiento: 'Use o formato YYYY-MM-DD. Ex.: 2026-05-07.',
    });

    expect(
      validateDividaForm({
        ...validValues,
        fechaInicio: '01/05/2026',
        fechaVencimiento: '31/12/2026',
      }),
    ).toEqual({
      fechaInicio: 'Use o formato YYYY-MM-DD. Ex.: 2026-04-07.',
      fechaVencimiento: 'Use o formato YYYY-MM-DD. Ex.: 2027-04-07.',
    });
  });

  it('validates optional numeric fields only when filled', () => {
    expect(
      validateDividaForm({
        ...validValues,
        cuotaMensual: 'abc',
        tasaInteres: 'abc',
      }),
    ).toEqual({
      cuotaMensual: 'Informe uma cuota mensal valida. Ex.: 450,00',
      tasaInteres: 'Informe uma taxa de interesse valida. Ex.: 2,5',
    });
  });
});
