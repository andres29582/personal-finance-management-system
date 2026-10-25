import { InternalServerAppException } from './exceptions';

export function moneyToCents(value: number | string): bigint {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(
    String(value),
  );
  if (!match || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new InternalServerAppException(
      'Valor monetario invalido ou sem precisao de centavos.',
    );
  }
  const [, sign, whole, fraction = '', exponent = '0'] = match;
  const shift = 2 + Number(exponent) - fraction.length;
  if (!Number.isSafeInteger(shift) || Math.abs(shift) > 1000) {
    throw new InternalServerAppException(
      'Valor monetario fora da precisao suportada.',
    );
  }
  const digits = BigInt(whole + fraction);
  const scale = 10n ** BigInt(Math.abs(shift));
  if (shift < 0 && digits % scale !== 0n) {
    throw new InternalServerAppException(
      'Valor monetario invalido ou sem precisao de centavos.',
    );
  }
  const cents = shift < 0 ? digits / scale : digits * scale;
  return sign === '-' ? -cents : cents;
}

export function centsToMoney(cents: bigint): number {
  const absolute = cents < 0n ? -cents : cents;
  const result = Number(
    `${cents < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`,
  );
  if (!Number.isFinite(result) || moneyToCents(result) !== cents) {
    throw new InternalServerAppException(
      'Total monetario nao pode ser representado com precisao na resposta numerica.',
    );
  }
  return result;
}
