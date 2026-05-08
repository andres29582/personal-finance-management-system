import { BadRequestException } from '@nestjs/common';
import { toNumber } from './number.util';

export function assertPositiveFinancialValue(
  value: number | string | null | undefined,
  fieldName = 'Valor',
): void {
  if (toNumber(value) <= 0) {
    throw new BadRequestException(`${fieldName} deve ser maior que zero.`);
  }
}

export function assertNonNegativeFinancialValue(
  value: number | string | null | undefined,
  fieldName = 'Valor',
): void {
  if (toNumber(value) < 0) {
    throw new BadRequestException(`${fieldName} nao pode ser negativo.`);
  }
}
