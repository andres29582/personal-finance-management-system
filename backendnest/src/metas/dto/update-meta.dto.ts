import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { MAX_FINANCIAL_AMOUNT } from '../../common/monetary-limits';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class UpdateMetaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  @Max(MAX_FINANCIAL_AMOUNT)
  montoObjetivo?: number;

  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @Min(0)
  @Max(MAX_FINANCIAL_AMOUNT)
  montoActual?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsDateString(
    { strict: true },
    { message: 'fechaLimite deve ser uma data valida.' },
  )
  fechaLimite?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
