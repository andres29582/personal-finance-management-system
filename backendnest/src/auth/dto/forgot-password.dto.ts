import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

function normalizeLowercaseStringValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class ForgotPasswordDto {
  @Transform(({ value }: { value: unknown }) =>
    normalizeLowercaseStringValue(value),
  )
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
