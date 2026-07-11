import { registerDecorator, ValidationOptions } from 'class-validator';

export const PASSWORD_MIN_CHARACTERS = 6;
export const PASSWORD_MAX_CHARACTERS = 64;
export const PASSWORD_MAX_UTF8_BYTES = 72;

export const PASSWORD_POLICY_MESSAGE =
  'A senha deve ter entre 6 e 64 caracteres, nao pode conter apenas espacos e deve ter no maximo 72 bytes UTF-8.';

function countUnicodeCharacters(value: string): number {
  return Array.from(value).length;
}

export function getUtf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function isPasswordValid(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const characterLength = countUnicodeCharacters(value);

  return (
    value.trim().length > 0 &&
    characterLength >= PASSWORD_MIN_CHARACTERS &&
    characterLength <= PASSWORD_MAX_CHARACTERS &&
    getUtf8ByteLength(value) <= PASSWORD_MAX_UTF8_BYTES
  );
}

export function IsValidPassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isValidPassword',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: {
        message: PASSWORD_POLICY_MESSAGE,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return isPasswordValid(value);
        },
        defaultMessage(): string {
          return PASSWORD_POLICY_MESSAGE;
        },
      },
    });
  };
}
