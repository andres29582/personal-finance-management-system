import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
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

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @Transform(({ value }: { value: unknown }) =>
    normalizeLowercaseStringValue(value),
  )
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Transform(({ value }: { value: unknown }) => normalizeDigitsValue(value))
  @Matches(/^\d{11}$/, {
    message: 'CPF deve conter 11 digitos.',
  })
  cpf: string;

  @Transform(({ value }: { value: unknown }) => normalizeDigitsValue(value))
  @Matches(/^\d{8}$/, {
    message: 'CEP deve conter 8 digitos.',
  })
  cep: string;

  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  endereco: string;

  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  numero: string;

  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cidade: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  senha: string;
}
