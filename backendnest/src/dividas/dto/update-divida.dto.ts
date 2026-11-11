import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
  Max,
} from 'class-validator';
import {
  MAX_INTEREST_RATE,
  MAX_FINANCIAL_AMOUNT,
} from '../../common/monetary-limits';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';
import { Periodicidade } from '../enums/periodicidade.enum';

export class UpdateDividaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_INTEREST_RATE)
  @HasAtMostTwoDecimalPlaces()
  tasaInteres?: number;

  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  @Max(MAX_FINANCIAL_AMOUNT)
  cuotaMensual?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaVencimiento deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'fechaVencimiento deve ser uma data valida.' },
  )
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'proximoVencimiento deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'proximoVencimiento deve ser uma data valida.' },
  )
  proximoVencimiento?: string;

  @IsOptional()
  @IsEnum(Periodicidade)
  periodicidade?: Periodicidade;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
