import { ValidationAppException } from './exceptions';

export type DateRange = {
  endDate: string;
  label: string;
  startDate: string;
};

const MONTH_REFERENCE_PATTERN = /^\d{4}-\d{2}$/;

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function normalizeMonthReference(monthReference?: string): string {
  if (!monthReference) {
    return formatIsoDate(new Date()).slice(0, 7);
  }

  if (!MONTH_REFERENCE_PATTERN.test(monthReference)) {
    throw new ValidationAppException(
      'INVALID_MONTH_REFERENCE',
      'Mes de referencia invalido. Use o formato YYYY-MM.',
      { field: 'mes' },
    );
  }

  return monthReference;
}

export function resolveMonthRange(monthReference?: string): DateRange {
  const normalizedMonthReference = normalizeMonthReference(monthReference);
  const [year, month] = normalizedMonthReference.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  return {
    label: normalizedMonthReference,
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(endDate),
  };
}

export function resolveQuarterRange(year: number, quarter: number): DateRange {
  if (!Number.isInteger(year) || year < 2000) {
    throw new ValidationAppException(
      'INVALID_REPORT_YEAR',
      'Ano invalido para relatorio trimestral.',
      { field: 'ano' },
    );
  }

  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new ValidationAppException(
      'INVALID_REPORT_QUARTER',
      'Trimestre invalido. Use valores entre 1 e 4.',
      { field: 'trimestre' },
    );
  }

  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(Date.UTC(year, startMonth, 1));
  const endDate = new Date(Date.UTC(year, startMonth + 3, 0));

  return {
    label: `${year}-T${quarter}`,
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(endDate),
  };
}

export function resolveCustomRange(
  startDate: string,
  endDate: string,
): DateRange {
  if (!startDate || !endDate) {
    throw new ValidationAppException(
      'CUSTOM_RANGE_REQUIRES_DATES',
      'Periodo por intervalo exige dataInicio e dataFim.',
    );
  }

  const parsedStartDate = new Date(`${startDate}T00:00:00.000Z`);
  const parsedEndDate = new Date(`${endDate}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedStartDate.getTime()) ||
    Number.isNaN(parsedEndDate.getTime())
  ) {
    throw new ValidationAppException(
      'INVALID_REPORT_DATES',
      'Datas invalidas para o relatorio.',
    );
  }

  if (parsedStartDate > parsedEndDate) {
    throw new ValidationAppException(
      'INVALID_REPORT_DATE_ORDER',
      'Data inicial nao pode ser maior que a data final.',
    );
  }

  return {
    label: `${startDate}_${endDate}`,
    startDate,
    endDate,
  };
}
