import { IsUUID } from 'class-validator';

export class FindGastosPlanejamentoParamsDto {
  @IsUUID()
  planejamentoId: string;
}
