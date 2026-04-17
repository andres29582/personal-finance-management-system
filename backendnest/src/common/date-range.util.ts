import { BadRequestException } from '@nestjs/common';

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
    throw new BadRequestException(
      'Mes de referencia invalido. Use o formato YYYY-MM.',
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
    throw new BadRequestException('Ano invalido para relatorio trimestral.');
  }

  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new BadRequestException(
      'Trimestre invalido. Use valores entre 1 e 4.',
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
    throw new BadRequestException(
      'Periodo por intervalo exige dataInicio e dataFim.',
    );
  }

  const parsedStartDate = new Date(`${startDate}T00:00:00.000Z`);
  const parsedEndDate = new Date(`${endDate}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedStartDate.getTime()) ||
    Number.isNaN(parsedEndDate.getTime())
  ) {
    throw new BadRequestException('Datas invalidas para o relatorio.');
  }

  if (parsedStartDate > parsedEndDate) {
    throw new BadRequestException(
      'Data inicial nao pode ser maior que a data final.',
    );
  }

  return {
    label: `${startDate}_${endDate}`,
    startDate,
    endDate,
  };
}
