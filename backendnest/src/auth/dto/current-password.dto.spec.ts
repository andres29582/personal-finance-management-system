import { validate } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto';

describe('authenticated password change proof', () => {
  it.each([undefined, null, '', 123])(
    'rejects missing or malformed current password %p',
    async (senhaAtual) => {
      const errors = await validate(
        Object.assign(new ResetPasswordDto(), {
          senhaAtual,
          novaSenha: 'NewPassword123',
        }),
      );
      expect(errors.some(({ property }) => property === 'senhaAtual')).toBe(
        true,
      );
    },
  );
  it('accepts legacy short current passwords unchanged', async () => {
    expect(
      await validate(
        Object.assign(new ResetPasswordDto(), {
          senhaAtual: ' old ',
          novaSenha: 'NewPassword123',
        }),
      ),
    ).toEqual([]);
  });
});
