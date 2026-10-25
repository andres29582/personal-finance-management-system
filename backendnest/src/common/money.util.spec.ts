import { moneyToCents, centsToMoney } from './money.util';

describe('exact cent arithmetic boundaries', () => {
  it.each<[number | string, bigint]>([
    [0.1, 10n],
    [0.29, 29n],
    [-0.1, -10n],
    ['-0.10', -10n],
    ['+1.2300', 123n],
    [1e2, 10000n],
    [1e-2, 1n],
    [999999999999.99, 99999999999999n],
    ['100000000000000.00', 10000000000000000n],
  ])('converts %s without floating multiplication', (value, cents) => {
    expect(moneyToCents(value)).toBe(cents);
  });
  it.each([
    0.001,
    0.30000000000000004,
    '0.001',
    '',
    'invalid',
    NaN,
    Infinity,
    null,
    undefined,
  ])('fails closed for invalid money %s', (value) => {
    expect(() => moneyToCents(value as number)).toThrow();
  });
  it.each([
    0n,
    1n,
    -1n,
    29n,
    99999999999999n,
    10000000000000000n,
    100000000000000000000000n,
  ])('keeps numeric JSON projections cent-roundtrip safe for %s', (cents) => {
    const result = centsToMoney(cents);
    expect(typeof result).toBe('number');
    expect(moneyToCents(JSON.parse(JSON.stringify(result)) as number)).toBe(
      cents,
    );
  });
  it('rejects a safe integer cent count whose numeric money projection loses a cent', () => {
    expect(Number.isSafeInteger(Number(9007199254740991n))).toBe(true);
    expect(() => centsToMoney(9007199254740991n)).toThrow(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
      }),
    );
  });
});
