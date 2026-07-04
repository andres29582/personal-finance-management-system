import { IsEnum, IsOptional } from 'class-validator';
import { PlanejamentoStatus } from '../enums';

export class FindPlanejamentosDto {
  @IsOptional()
  @IsEnum(PlanejamentoStatus)
  status?: PlanejamentoStatus;
}
