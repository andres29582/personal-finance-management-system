import { isValidDateInput } from '../validators/dateInput';

describe('isValidDateInput', () => {
  it('accepts valid YYYY-MM-DD dates', () => {
    expect(isValidDateInput('2026-04-07')).toBe(true);
    expect(isValidDateInput('2028-02-29')).toBe(true);
  });

  it('rejects invalid calendar dates', () => {
    expect(isValidDateInput('2026-02-29')).toBe(false);
    expect(isValidDateInput('2026-04-31')).toBe(false);
    expect(isValidDateInput('2026-13-01')).toBe(false);
  });

  it('rejects values outside the expected format', () => {
    expect(isValidDateInput('07/04/2026')).toBe(false);
    expect(isValidDateInput('2026-4-7')).toBe(false);
    expect(isValidDateInput('')).toBe(false);
  });
});
