import { ValidationAppException } from './exceptions';
import {
  normalizeMonthReference,
  resolveCustomRange,
  resolveQuarterRange,
} from './date-range.util';

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

describe('date range utils', () => {
  it('throws a typed error for invalid month references', () => {
    const error = captureValidationException(() =>
      normalizeMonthReference('2026/04'),
    );

    expect(error).toMatchObject({
      code: 'INVALID_MONTH_REFERENCE',
      field: 'mes',
      message: 'Mes de referencia invalido. Use o formato YYYY-MM.',
      statusCode: 422,
    });
  });

  it('throws a typed error for invalid quarters', () => {
    const error = captureValidationException(() =>
      resolveQuarterRange(2026, 5),
    );

    expect(error).toMatchObject({
      code: 'INVALID_REPORT_QUARTER',
      field: 'trimestre',
      message: 'Trimestre invalido. Use valores entre 1 e 4.',
      statusCode: 422,
    });
  });

  it('throws a typed error when custom range dates are inverted', () => {
    const error = captureValidationException(() =>
      resolveCustomRange('2026-05-01', '2026-04-01'),
    );

    expect(error).toMatchObject({
      code: 'INVALID_REPORT_DATE_ORDER',
      field: undefined,
      message: 'Data inicial nao pode ser maior que a data final.',
      statusCode: 422,
    });
  });
});
