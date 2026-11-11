import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MAX_ACCOUNT_AMOUNT } from '../../common/monetary-limits';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';
import { TipoConta } from '../enums/tipo-conta.enum';

export class CreateContaDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(TipoConta)
  tipo: TipoConta;

  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @Max(MAX_ACCOUNT_AMOUNT)
  @Min(-MAX_ACCOUNT_AMOUNT)
  saldoInicial: number;

  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @Max(MAX_ACCOUNT_AMOUNT)
  @Min(-MAX_ACCOUNT_AMOUNT)
  limiteCredito?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dataCorte?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dataPagamento?: number;
}
