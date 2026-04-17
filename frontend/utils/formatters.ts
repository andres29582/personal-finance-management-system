import { parseDecimalInput } from './number-input';

export function toDisplayNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return 0;
    }

    const directNumber = Number(normalizedValue);

    if (Number.isFinite(directNumber)) {
      return directNumber;
    }

    const parsedDecimal = parseDecimalInput(normalizedValue);

    return Number.isFinite(parsedDecimal) ? parsedDecimal : 0;
  }

  return 0;
}

export function formatCurrency(value: number | string | null | undefined) {
  const safeValue = toDisplayNumber(value);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(safeValue);
}

export function formatDate(date: string | null | undefined) {
  if (!date) {
    return '-';
  }

  const [year, month, day] = date.split('-');

  if (!year || !month || !day) {
    return date;
  }

  return `${day}/${month}/${year}`;
}

export function getCurrentMonthReference() {
  return new Date().toISOString().slice(0, 7);
}
