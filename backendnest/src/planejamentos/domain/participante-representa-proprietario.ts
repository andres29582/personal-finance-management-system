import { ParticipantePlanejamento } from '../entities/participante-planejamento.entity';
import { Planejamento } from '../entities/planejamento.entity';

export function participanteRepresentaProprietario(
  planejamento: Pick<Planejamento, 'id' | 'usuarioCriadorId'>,
  participante: Pick<ParticipantePlanejamento, 'planejamentoId' | 'usuarioId'>,
): boolean {
  return (
    participante.planejamentoId === planejamento.id &&
    participante.usuarioId === planejamento.usuarioCriadorId
  );
}
