export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCep(value: string): boolean {
  return /^\d{8}$/.test(normalizeDigits(value));
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeDigits(value);
  return /^\d{11}$/.test(cpf);
}
