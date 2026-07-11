import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { ResetPasswordTokenDto } from './reset-password-token.dto';

function validRegisterDto(senha: string): RegisterDto {
  return Object.assign(new RegisterDto(), {
    nome: 'Ana',
    email: 'ana@example.com',
    cpf: '52998224725',
    cep: '01001000',
    endereco: 'Rua A',
    numero: '1',
    cidade: 'Sao Paulo',
    senha,
    aceitoPoliticaPrivacidade: true,
  });
}

describe('password policy DTO integration', () => {
  it.each([
    ['register', validRegisterDto('short')],
    [
      'authenticated reset',
      Object.assign(new ResetPasswordDto(), { novaSenha: 'short' }),
    ],
    [
      'token reset',
      Object.assign(new ResetPasswordTokenDto(), {
        token: 'valid-token',
        novaSenha: 'short',
      }),
    ],
  ])('applies the same password policy to %s', async (_name, dto) => {
    const errors = await validate(dto);
    const passwordError = errors.find(({ property }) =>
      ['senha', 'novaSenha'].includes(property),
    );

    expect(passwordError?.constraints).toHaveProperty('isValidPassword');
  });

  it('does not apply the new policy to login passwords', async () => {
    const dto = Object.assign(new LoginDto(), {
      email: 'legacy@example.com',
      senha: 'old',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
