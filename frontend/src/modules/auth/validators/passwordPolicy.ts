export const PASSWORD_MIN_CHARACTERS = 6;
export const PASSWORD_MAX_CHARACTERS = 64;
export const PASSWORD_MAX_UTF8_BYTES = 72;

export const PASSWORD_LENGTH_MESSAGE = 'A senha deve ter entre 6 e 64 caracteres.';
export const PASSWORD_UTF8_MESSAGE =
  'A senha contem muitos caracteres especiais ou emojis.';

export type PasswordValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function validatePassword(value: unknown): PasswordValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, message: PASSWORD_LENGTH_MESSAGE };
  }

  const characterLength = Array.from(value).length;

  if (
    value.trim().length === 0 ||
    characterLength < PASSWORD_MIN_CHARACTERS ||
    characterLength > PASSWORD_MAX_CHARACTERS
  ) {
    return { valid: false, message: PASSWORD_LENGTH_MESSAGE };
  }

  if (getUtf8ByteLength(value) > PASSWORD_MAX_UTF8_BYTES) {
    return { valid: false, message: PASSWORD_UTF8_MESSAGE };
  }

  return { valid: true };
}
