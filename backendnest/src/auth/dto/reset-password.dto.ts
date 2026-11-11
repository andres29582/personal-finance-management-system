import { IsNotEmpty, IsString } from 'class-validator';
import { IsValidPassword } from '../validators/password-policy';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  senhaAtual: string;

  @IsString()
  @IsNotEmpty()
  @IsValidPassword()
  novaSenha: string;
}
