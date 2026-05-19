import { ValidationAppException } from './exceptions';
import {
  normalizeMonthReference,
  resolveCustomRange,
  resolveQuarterRange,
} from './date-range.util';

describe('date range utils', () => {
  it('throws a typed error for invalid month references', () => {
    expect(() => normalizeMonthReference('2026/04')).toThrow(
      ValidationAppException,
    );
    expect(() => normalizeMonthReference('2026/04')).toThrow(
      expect.objectContaining({
        code: 'INVALID_MONTH_REFERENCE',
        field: 'mes',
        statusCode: 422,
      }),
    );
  });

  it('throws a typed error for invalid quarters', () => {
    expect(() => resolveQuarterRange(2026, 5)).toThrow(
      expect.objectContaining({
        code: 'INVALID_REPORT_QUARTER',
        field: 'trimestre',
        statusCode: 422,
      }),
    );
  });

  it('throws a typed error when custom range dates are inverted', () => {
    expect(() => resolveCustomRange('2026-05-01', '2026-04-01')).toThrow(
      expect.objectContaining({
        code: 'INVALID_REPORT_DATE_ORDER',
        statusCode: 422,
      }),
    );
  });
});
