export const E2E_DATES = {
  emptyMonth: '2026-04',
  nextMonth: '2026-06',
  targetMonth: '2026-05',
  targetMonthEnd: '2026-05-31',
  targetMonthStart: '2026-05-01',
} as const;

export const E2E_DATE_VALUES = {
  debtDue: '2026-12-01',
  debtStart: E2E_DATES.targetMonthStart,
  debtPayment: '2026-05-17',
  expense: '2026-05-10',
  futureIncome: '2026-06-03',
  goalDeadline: '2026-12-31',
  income: '2026-05-05',
  transfer: '2026-05-15',
} as const;
