import { IsNumber, IsOptional } from 'class-validator';

export class UpdateOrcamentoDto {
  @IsOptional()
  @IsNumber()
  valorPlanejado?: number;
}
