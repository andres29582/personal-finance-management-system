import { IsNotEmpty, IsNumber, Matches } from 'class-validator';

export class CreateOrcamentoDto {
  @Matches(/^\d{4}-\d{2}$/)
  @IsNotEmpty()
  mesReferencia: string;

  @IsNumber()
  valorPlanejado: number;
}
