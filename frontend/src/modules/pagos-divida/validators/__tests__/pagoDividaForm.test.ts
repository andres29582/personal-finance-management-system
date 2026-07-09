import { validatePagoDividaForm } from '../pagoDividaForm';

const validValues = {
  categoriaId: 'categoria-1',
  contaId: 'conta-1',
  data: '2026-05-05',
  descricao: 'Pagamento de parcela',
  dividaId: 'divida-1',
  valor: '300,75',
};

describe('validatePagoDividaForm', () => {
  it('accepts a valid payment form and returns parsed value', () => {
    expect(validatePagoDividaForm(validValues)).toEqual({
      valid: true,
      parsedValor: 300.75,
    });
  });

  it.each(['', 'valor-invalido'])(
    'rejects empty or invalid payment value: %s',
    (valor) => {
      expect(validatePagoDividaForm({ ...validValues, valor })).toEqual({
        valid: false,
        message: 'Preencha conta, categoria, valor e data.',
      });
    },
  );

  it.each(['0', '-10'])('rejects non-positive payment value: %s', (valor) => {
    expect(validatePagoDividaForm({ ...validValues, valor })).toEqual({
      valid: false,
      message: 'O valor deve ser maior que zero.',
    });
  });

  it('rejects invalid calendar date', () => {
    expect(validatePagoDividaForm({ ...validValues, data: '2026-99-99' })).toEqual({
      valid: false,
      message: 'Informe uma data valida no formato YYYY-MM-DD.',
    });
  });

  it('rejects Brazilian date format', () => {
    expect(validatePagoDividaForm({ ...validValues, data: '01/05/2026' })).toEqual({
      valid: false,
      message: 'Informe uma data valida no formato YYYY-MM-DD.',
    });
  });
});
