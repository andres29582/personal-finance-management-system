import { parseDecimalInput } from '../../utils/number-input';

describe('parseDecimalInput', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['-R$ 1.234,56', -1234.56],
    ['1.234', 1234],
    ['1,234', 1.234],
    ['1.234.560', 1234560],
    ['1,234,560', 1234560],
    ['-R$ 1.234.560', -1234560],
    ['R$ 1,234,560', 1234560],
    ['1.234.560,78', 1234560.78],
    ['1,234,560.78', 1234560.78],
    ['0,01', 0.01],
    ['.5', 0.5],
    ['1234.567', 1234567],
    ['1.23.456', Number.NaN],
    ['1,23,456', Number.NaN],
    ['1.234,560.78', Number.NaN],
    ['', Number.NaN],
    ['NaN', Number.NaN],
    ['Infinity', Number.NaN],
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
