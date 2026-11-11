import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { MAX_FINANCIAL_AMOUNT } from '../../common/monetary-limits';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class UpdateTransferenciaDto {
  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  @Max(MAX_FINANCIAL_AMOUNT)
  valor?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'data deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString({ strict: true }, { message: 'data deve ser uma data valida.' })
  data?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @Min(0)
  @Max(MAX_FINANCIAL_AMOUNT)
  comissao?: number;
}
