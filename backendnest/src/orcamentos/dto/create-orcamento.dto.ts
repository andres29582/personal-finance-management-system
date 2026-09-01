import { IsNotEmpty, IsNumber, IsPositive, Matches } from 'class-validator';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class CreateOrcamentoDto {
  @Matches(/^\d{4}-\d{2}$/)
  @IsNotEmpty()
  mesReferencia: string;

  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  valorPlanejado: number;
}
