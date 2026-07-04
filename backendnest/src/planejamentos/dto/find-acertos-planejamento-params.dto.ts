import { IsUUID } from 'class-validator';

export class FindAcertosPlanejamentoParamsDto {
  @IsUUID()
  planejamentoId: string;
}
