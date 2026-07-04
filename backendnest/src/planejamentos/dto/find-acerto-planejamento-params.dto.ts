import { IsUUID } from 'class-validator';

export class FindAcertoPlanejamentoParamsDto {
  @IsUUID()
  planejamentoId: string;

  @IsUUID()
  acertoId: string;
}
