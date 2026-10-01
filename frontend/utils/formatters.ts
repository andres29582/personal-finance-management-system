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

export function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getLocalMonthReference(date = new Date()) {
  return getLocalDateInputValue(date).slice(0, 7);
}

export function getCurrentMonthReference() {
  return getLocalMonthReference();
}
