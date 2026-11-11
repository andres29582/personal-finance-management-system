import { IsNotEmpty, IsNumber, IsPositive, IsUUID, Max } from 'class-validator';
import { MAX_FINANCIAL_AMOUNT } from '../../common/monetary-limits';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class CreateOrcamentoCategoriaDto {
  @IsUUID()
  @IsNotEmpty()
  categoriaId: string;

  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  @Max(MAX_FINANCIAL_AMOUNT)
  valorPlanejado: number;
}
