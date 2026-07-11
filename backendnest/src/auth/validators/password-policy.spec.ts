import { validate } from 'class-validator';
import {
  IsValidPassword,
  PASSWORD_POLICY_MESSAGE,
  getUtf8ByteLength,
  isPasswordValid,
} from './password-policy';

class PasswordDto {
  @IsValidPassword()
  senha: unknown;
}

describe('password policy', () => {
  it('accepts a password with exactly 6 ASCII characters', () => {
    expect(isPasswordValid('abc123')).toBe(true);
  });

  it('accepts internal and surrounding spaces without modifying the password', () => {
    expect(isPasswordValid(' senha segura ')).toBe(true);
  });

  it('accepts a password with exactly 64 ASCII characters', () => {
    expect(isPasswordValid('a'.repeat(64))).toBe(true);
  });

  it('rejects a password shorter than 6 characters', () => {
    expect(isPasswordValid('abc12')).toBe(false);
  });

  it('rejects a password longer than 64 Unicode characters', () => {
    expect(isPasswordValid('a'.repeat(65))).toBe(false);
  });

  it('rejects a password containing only spaces', () => {
    expect(isPasswordValid('      ')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isPasswordValid(undefined)).toBe(false);
    expect(isPasswordValid(null)).toBe(false);
    expect(isPasswordValid(123456)).toBe(false);
  });

  it('accepts a Unicode password with exactly 72 UTF-8 bytes', () => {
    const password = '😀'.repeat(18);

    expect(getUtf8ByteLength(password)).toBe(72);
    expect(isPasswordValid(password)).toBe(true);
  });

  it('rejects a Unicode password exceeding 72 UTF-8 bytes', () => {
    const password = '😀'.repeat(19);

    expect(getUtf8ByteLength(password)).toBe(76);
    expect(isPasswordValid(password)).toBe(false);
  });

  it('applies the reusable decorator with the centralized message', async () => {
    const dto = new PasswordDto();
    dto.senha = 'short';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      isValidPassword: PASSWORD_POLICY_MESSAGE,
    });
  });

  it('accepts a valid value through the reusable decorator', async () => {
    const dto = new PasswordDto();
    dto.senha = 'senha segura';

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
