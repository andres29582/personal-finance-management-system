import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MAX_ACCOUNT_AMOUNT } from '../../common/monetary-limits';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class UpdateContaDto {
  @IsOptional()
  @IsString()
  nome?: string;

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

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
