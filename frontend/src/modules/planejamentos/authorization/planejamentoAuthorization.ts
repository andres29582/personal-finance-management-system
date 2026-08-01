import type {
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
} from '../types/planejamento';

type PlanejamentoAuthorizationContext = Pick<
  Planejamento,
  'participantes' | 'status' | 'usuarioCriadorId'
>;

type GastoAuthorizationContext = Pick<GastoPlanejamento, 'status'>;

export function isPlanejamentoOwner(
  planejamento: PlanejamentoAuthorizationContext | null | undefined,
  usuarioAutenticadoId: string | null | undefined,
) {
  if (!planejamento || !usuarioAutenticadoId) {
    return false;
  }

  return usuarioAutenticadoId === planejamento.usuarioCriadorId;
}

export function findActiveLinkedParticipant(
  planejamento: PlanejamentoAuthorizationContext | null | undefined,
  usuarioAutenticadoId: string | null | undefined,
): ParticipantePlanejamento | null {
  if (!usuarioAutenticadoId) {
    return null;
  }

  return (
    planejamento?.participantes?.find(
      (participante) =>
        participante.usuarioId === usuarioAutenticadoId &&
        participante.tipo === 'VINCULADO' &&
        participante.status === 'ATIVO',
    ) ?? null
  );
}

export function canAddPlanejamentoParticipant(
  planejamento: PlanejamentoAuthorizationContext | null | undefined,
  usuarioAutenticadoId: string | null | undefined,
) {
  return (
    planejamento?.status === 'ABERTO' &&
    isPlanejamentoOwner(planejamento, usuarioAutenticadoId)
  );
}

export function canCreatePlanejamentoExpense(
  planejamento: PlanejamentoAuthorizationContext | null | undefined,
  usuarioAutenticadoId: string | null | undefined,
) {
  if (planejamento?.status !== 'ABERTO') {
    return false;
  }

  return (
    isPlanejamentoOwner(planejamento, usuarioAutenticadoId) ||
    !!findActiveLinkedParticipant(planejamento, usuarioAutenticadoId)
  );
}

export function canEditPlanejamentoExpense(
  planejamento: PlanejamentoAuthorizationContext | null | undefined,
  gasto: GastoAuthorizationContext | null | undefined,
  usuarioAutenticadoId: string | null | undefined,
) {
  return (
    gasto?.status === 'ATIVO' &&
    planejamento?.status === 'ABERTO' &&
    isPlanejamentoOwner(planejamento, usuarioAutenticadoId)
  );
}
