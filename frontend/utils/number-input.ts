export function parseDecimalInput(rawValue: string): number {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return Number.NaN;
  }

  const isNegative = trimmedValue.startsWith('-');
  const sanitizedValue = trimmedValue
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/-/g, '');

  if (!sanitizedValue) {
    return Number.NaN;
  }

  const lastCommaIndex = sanitizedValue.lastIndexOf(',');
  const lastDotIndex = sanitizedValue.lastIndexOf('.');
  const decimalSeparatorIndex = Math.max(lastCommaIndex, lastDotIndex);
  const separatorMatches = sanitizedValue.match(/[.,]/g) ?? [];

  if (decimalSeparatorIndex === -1) {
    const digitsOnly = sanitizedValue.replace(/\D/g, '');
    return Number(`${isNegative ? '-' : ''}${digitsOnly}`);
  }

  const integerCandidate = sanitizedValue.slice(0, decimalSeparatorIndex);
  const decimalCandidate = sanitizedValue.slice(decimalSeparatorIndex + 1);
  const digitsAfterSeparator = decimalCandidate.replace(/\D/g, '');
  const hasSingleDotSeparator =
    separatorMatches.length === 1 && lastDotIndex !== -1 && lastCommaIndex === -1;

  // Heuristic: "1.234" is usually a thousands-formatted value in this app.
  if (
    hasSingleDotSeparator &&
    digitsAfterSeparator.length === 3 &&
    integerCandidate.replace(/\D/g, '').length > 0
  ) {
    const thousandsValue = `${integerCandidate}${decimalCandidate}`.replace(/\D/g, '');
    return Number(`${isNegative ? '-' : ''}${thousandsValue}`);
  }

  const integerPart = integerCandidate.replace(/\D/g, '');
  const decimalPart = digitsAfterSeparator;

  if (!integerPart && !decimalPart) {
    return Number.NaN;
  }

  const normalizedValue = decimalPart
    ? `${integerPart || '0'}.${decimalPart}`
    : integerPart;

  return Number(`${isNegative ? '-' : ''}${normalizedValue}`);
}
