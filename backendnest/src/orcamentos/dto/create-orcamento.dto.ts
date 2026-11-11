import { IsNotEmpty, IsNumber, IsPositive, Matches, Max } from 'class-validator';
import { MAX_FINANCIAL_AMOUNT } from '../../common/monetary-limits';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class CreateOrcamentoDto {
  @Matches(/^\d{4}-\d{2}$/)
  @IsNotEmpty()
  mesReferencia: string;

  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  @Max(MAX_FINANCIAL_AMOUNT)
  valorPlanejado: number;
}
