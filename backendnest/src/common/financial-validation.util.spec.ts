import { ValidationAppException } from './exceptions';
import {
  assertNonNegativeFinancialValue,
  assertPositiveFinancialValue,
} from './financial-validation.util';

describe('financial validation utils', () => {
  it('throws a typed error for non-positive values', () => {
    expect(() => assertPositiveFinancialValue(0, 'Valor')).toThrow(
      ValidationAppException,
    );
    expect(() => assertPositiveFinancialValue(0, 'Valor')).toThrow(
      expect.objectContaining({
        code: 'FINANCIAL_VALUE_MUST_BE_POSITIVE',
        message: 'Valor deve ser maior que zero.',
        statusCode: 422,
      }),
    );
  });

  it('throws a typed error for negative values', () => {
    expect(() => assertNonNegativeFinancialValue(-1, 'Comissao')).toThrow(
      ValidationAppException,
    );
    expect(() => assertNonNegativeFinancialValue(-1, 'Comissao')).toThrow(
      expect.objectContaining({
        code: 'FINANCIAL_VALUE_MUST_BE_NON_NEGATIVE',
        message: 'Comissao nao pode ser negativo.',
        statusCode: 422,
      }),
    );
  });
});
