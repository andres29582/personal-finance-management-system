import { IsUUID } from 'class-validator';

export class RemoveParticipantePlanejamentoParamsDto {
  @IsUUID()
  planejamentoId: string;

  @IsUUID()
  participanteId: string;
}
