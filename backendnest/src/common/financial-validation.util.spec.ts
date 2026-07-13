import { ValidationAppException } from './exceptions';
import {
  assertNonNegativeFinancialValue,
  assertPositiveFinancialValue,
} from './financial-validation.util';

function captureValidationException(
  action: () => void,
): ValidationAppException {
  try {
    action();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ValidationAppException);

    if (!(error instanceof ValidationAppException)) {
      throw error;
    }

    return error;
  }

  throw new Error('Expected ValidationAppException to be thrown.');
}

describe('financial validation utils', () => {
  it('throws a typed error for non-positive values', () => {
    const error = captureValidationException(() =>
      assertPositiveFinancialValue(0, 'Valor'),
    );

    expect(error).toMatchObject({
      code: 'FINANCIAL_VALUE_MUST_BE_POSITIVE',
      field: undefined,
      message: 'Valor deve ser maior que zero.',
      statusCode: 422,
    });
  });

  it('throws a typed error for negative values', () => {
    const error = captureValidationException(() =>
      assertNonNegativeFinancialValue(-1, 'Comissao'),
    );

    expect(error).toMatchObject({
      code: 'FINANCIAL_VALUE_MUST_BE_NON_NEGATIVE',
      field: undefined,
      message: 'Comissao nao pode ser negativo.',
      statusCode: 422,
    });
  });
});
