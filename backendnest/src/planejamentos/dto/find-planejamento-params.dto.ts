import { IsUUID } from 'class-validator';

export class FindPlanejamentoParamsDto {
  @IsUUID()
  id: string;
}
