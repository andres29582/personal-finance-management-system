import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

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
  @MinLength(6)
  novaSenha: string;
}
