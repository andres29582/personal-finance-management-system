import { describe, expect, it } from '@jest/globals';
import {
  getLocalDateInputValue,
  getLocalMonthReference,
} from '../utils/formatters';

describe('local calendar defaults', () => {
  it('uses local date and month across a UTC-midnight crossing', () => {
    const instant = new Date('2026-04-07T02:30:00.000Z');

    expect(getLocalDateInputValue(instant)).toBe('2026-04-06');
    expect(getLocalMonthReference(instant)).toBe('2026-04');
  });
});
