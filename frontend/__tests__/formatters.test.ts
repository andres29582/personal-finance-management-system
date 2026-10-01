import { describe, expect, it, jest } from '@jest/globals';
import {
  getCurrentMonthReference,
  getLocalDateInputValue,
  getLocalMonthReference,
} from '../utils/formatters';

describe('local calendar defaults', () => {
  it.each([
    ['2026-04-07T02:30:00.000Z', '2026-04-06', '2026-04'],
    ['2026-05-01T02:59:59.999Z', '2026-04-30', '2026-04'],
    ['2027-01-01T02:30:00.000Z', '2026-12-31', '2026-12'],
    ['2027-01-01T03:00:00.000Z', '2027-01-01', '2027-01'],
    ['2028-03-01T02:30:00.000Z', '2028-02-29', '2028-02'],
  ])('formats %s using the local calendar', (timestamp, date, month) => {
    const instant = new Date(timestamp);
    expect(getLocalDateInputValue(instant)).toBe(date);
    expect(getLocalMonthReference(instant)).toBe(month);
    jest.useFakeTimers();
    try {
      jest.setSystemTime(instant);
      expect(getLocalDateInputValue()).toBe(date);
      expect(getCurrentMonthReference()).toBe(month);
    } finally {
      jest.useRealTimers();
    }
  });
});
