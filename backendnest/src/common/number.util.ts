export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsedNumber = Number(value);
    return Number.isFinite(parsedNumber) ? parsedNumber : 0;
  }

  return 0;
}
