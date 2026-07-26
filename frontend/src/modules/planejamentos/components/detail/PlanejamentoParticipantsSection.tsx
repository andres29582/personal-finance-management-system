import { StyleSheet, Text } from 'react-native';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { GlassButton, GlassPanel } from '../../../../shared/ui';
import { ParticipantePlanejamento } from '../../types/planejamento';
import { ParticipanteRow } from './ParticipanteRow';

type PlanejamentoParticipantsSectionProps = {
  actionLoadingId: string | null;
  canAdd: boolean;
  canManageParticipants: boolean;
  errorMessage: string;
  infoMessage: string;
  mutationInProgress: boolean;
  onAdd: () => void;
  onRemove: (participante: ParticipantePlanejamento) => void;
  participantes: ParticipantePlanejamento[];
  usuarioCriadorId: string;
};

export function PlanejamentoParticipantsSection({
  actionLoadingId,
  canAdd,
  canManageParticipants,
  errorMessage,
  infoMessage,
  mutationInProgress,
  onAdd,
  onRemove,
  participantes,
  usuarioCriadorId,
}: PlanejamentoParticipantsSectionProps) {
  return (
    <GlassPanel
      title="Participantes"
      subtitle="Pessoas vinculadas a este planejamento."
      action={
        canAdd ? (
          <GlassButton
            disabled={mutationInProgress}
            label="Adicionar participante"
            onPress={onAdd}
            variant="ghost"
          />
        ) : undefined
      }
    >
      {errorMessage ? (
        <Text style={styles.actionError}>{errorMessage}</Text>
      ) : null}
      {infoMessage ? (
        <Text style={styles.actionInfo}>{infoMessage}</Text>
      ) : null}

      {participantes.length ? (
        participantes.map((participante) => {
          const isOwnerParticipant =
            participante.usuarioId === usuarioCriadorId;

          return (
            <ParticipanteRow
              key={participante.id}
              actionLoading={actionLoadingId === participante.id}
              canRemove={
                canManageParticipants &&
                participante.status === 'ATIVO' &&
                !isOwnerParticipant
              }
              disabled={mutationInProgress}
              isOwnerParticipant={isOwnerParticipant}
              onRemove={onRemove}
              participante={participante}
            />
          );
        })
      ) : (
        <Text style={styles.emptyText}>Nenhum participante cadastrado.</Text>
      )}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  actionError: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  actionInfo: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  emptyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
});
