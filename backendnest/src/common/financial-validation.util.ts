import { ValidationAppException } from './exceptions';
import { toNumber } from './number.util';

export function assertPositiveFinancialValue(
  value: number | string | null | undefined,
  fieldName = 'Valor',
): void {
  if (toNumber(value) <= 0) {
    throw new ValidationAppException(
      'FINANCIAL_VALUE_MUST_BE_POSITIVE',
      `${fieldName} deve ser maior que zero.`,
    );
  }
}

export function assertNonNegativeFinancialValue(
  value: number | string | null | undefined,
  fieldName = 'Valor',
): void {
  if (toNumber(value) < 0) {
    throw new ValidationAppException(
      'FINANCIAL_VALUE_MUST_BE_NON_NEGATIVE',
      `${fieldName} nao pode ser negativo.`,
    );
  }
}
