import { parseDecimalInput } from '../../utils/number-input';

describe('parseDecimalInput', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['-R$ 1.234,56', -1234.56],
    ['1.234', 1234],
    ['12abc3', Number.NaN],
    ['1-23', Number.NaN],
    ['R$-123', Number.NaN],
    ['1,23.4', Number.NaN],
  ])('parses %s', (rawValue, expected) => {
    const result = parseDecimalInput(rawValue);

    if (Number.isNaN(expected)) {
      expect(result).toBeNaN();
    } else {
      expect(result).toBe(expected);
    }
  });
});
