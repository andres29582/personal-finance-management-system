import { IsUUID } from 'class-validator';

export class FindGastoPlanejamentoParamsDto {
  @IsUUID()
  planejamentoId: string;

  @IsUUID()
  gastoId: string;
}
