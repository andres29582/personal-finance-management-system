import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class UpdateOrcamentoDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  valorPlanejado?: number;
}
