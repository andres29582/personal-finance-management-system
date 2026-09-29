import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class CreateOrcamentoCategoriaDto {
  @IsUUID()
  @IsNotEmpty()
  categoriaId: string;

  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  valorPlanejado: number;
}
