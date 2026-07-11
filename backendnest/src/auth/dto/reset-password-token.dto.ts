import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsValidPassword } from '../validators/password-policy';

function trimStringValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ResetPasswordTokenDto {
  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @IsValidPassword()
  novaSenha: string;
}
