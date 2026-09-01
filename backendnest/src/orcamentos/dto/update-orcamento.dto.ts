import { IsNumber, IsOptional, IsPositive } from 'class-validator';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class UpdateOrcamentoDto {
  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  valorPlanejado?: number;
}
