import {
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_UTF8_MESSAGE,
  getUtf8ByteLength,
  validatePassword,
} from './passwordPolicy';

describe('password policy', () => {
  it.each(['abc123', 'a'.repeat(64), ' senha segura ', 'senha\u{1F512}']) (
    'accepts a valid password without changing it: %s',
    (password) => {
      expect(validatePassword(password)).toEqual({ valid: true });
    },
  );

  it.each(['abc12', 'a'.repeat(65), '      '])(
    'rejects an invalid character length: %s',
    (password) => {
      expect(validatePassword(password)).toEqual({
        valid: false,
        message: PASSWORD_LENGTH_MESSAGE,
      });
    },
  );

  it('accepts exactly 72 UTF-8 bytes and rejects more than 72', () => {
    const exactly72Bytes = '\u{1F600}'.repeat(18);
    const moreThan72Bytes = '\u{1F600}'.repeat(19);

    expect(getUtf8ByteLength(exactly72Bytes)).toBe(72);
    expect(validatePassword(exactly72Bytes)).toEqual({ valid: true });
    expect(getUtf8ByteLength(moreThan72Bytes)).toBe(76);
    expect(validatePassword(moreThan72Bytes)).toEqual({
      valid: false,
      message: PASSWORD_UTF8_MESSAGE,
    });
  });
});
