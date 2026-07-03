import { distribuirCentavos } from './distribuir-centavos';
import { DivisaoGastoPlanejamento, PlanejamentoDominioError } from './types';

export function calcularDivisaoIgualitaria(
  valorCentavos: number,
  participantesIds: string[],
): DivisaoGastoPlanejamento[] {
  validarParticipantesSelecionados(participantesIds);

  const valores = distribuirCentavos(valorCentavos, participantesIds.length);

  return participantesIds.map((participanteId, indice) => ({
    participanteId,
    valorCentavos: valores[indice],
  }));
}

function validarParticipantesSelecionados(participantesIds: string[]): void {
  if (participantesIds.length === 0) {
    throw new PlanejamentoDominioError(
      'PARTICIPANTES_OBRIGATORIOS',
      'Lista de participantes nao pode estar vazia.',
    );
  }

  const participantesUnicos = new Set(participantesIds);

  if (participantesUnicos.size !== participantesIds.length) {
    throw new PlanejamentoDominioError(
      'PARTICIPANTE_DUPLICADO',
      'Participante duplicado na divisao.',
    );
  }
}
