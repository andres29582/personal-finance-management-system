import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizeDigits } from '../../common/br-documents.util';

function trimStringValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeLowercaseStringValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function normalizeDigitsValue(value: unknown): unknown {
  return typeof value === 'string' ? normalizeDigits(value) : value;
}

export class UpdateUserProfileDto {
  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  @Transform(({ value }: { value: unknown }) =>
    normalizeLowercaseStringValue(value),
  )
  @IsOptional()
  @IsEmail()
  email?: string;

  @Transform(({ value }: { value: unknown }) => normalizeDigitsValue(value))
  @IsOptional()
  @Matches(/^\d{11}$/, {
    message: 'CPF deve conter 11 digitos.',
  })
  cpf?: string;

  @Transform(({ value }: { value: unknown }) => normalizeDigitsValue(value))
  @IsOptional()
  @Matches(/^\d{8}$/, {
    message: 'CEP deve conter 8 digitos.',
  })
  cep?: string;

  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  endereco?: string;

  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cidade?: string;
}
