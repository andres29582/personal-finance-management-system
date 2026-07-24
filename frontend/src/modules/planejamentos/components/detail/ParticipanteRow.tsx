import { StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { GlassButton } from '../../../../shared/ui';
import {
  ParticipantePlanejamento,
  ParticipantePlanejamentoStatus,
  ParticipantePlanejamentoTipo,
} from '../../types/planejamento';

const participanteTipoLabel: Record<ParticipantePlanejamentoTipo, string> = {
  CONVIDADO: 'Convidado',
  MANUAL: 'Manual',
  VINCULADO: 'Vinculado',
};

const participanteStatusLabel: Record<ParticipantePlanejamentoStatus, string> = {
  ATIVO: 'Ativo',
  PENDENTE: 'Pendente',
  REMOVIDO: 'Removido',
};

type ParticipanteRowProps = {
  actionLoading: boolean;
  canRemove: boolean;
  disabled: boolean;
  isOwnerParticipant: boolean;
  onRemove: (participante: ParticipantePlanejamento) => void;
  participante: ParticipantePlanejamento;
};

export function ParticipanteRow({
  actionLoading,
  canRemove,
  disabled,
  isOwnerParticipant,
  onRemove,
  participante,
}: ParticipanteRowProps) {
  return (
    <View
      style={styles.participantRow}
      testID={`participante-row-${participante.id}`}
    >
      <View style={styles.participantAvatar}>
        <Text style={styles.participantInitial}>
          {participante.nome.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{participante.nome}</Text>
        {participante.email ? (
          <Text style={styles.participantEmail}>{participante.email}</Text>
        ) : null}
        <View style={styles.participantBadges}>
          <View style={styles.participantBadge}>
            <Text style={styles.participantBadgeText}>
              {participanteTipoLabel[participante.tipo]}
            </Text>
          </View>
          <View
            style={[
              styles.participantBadge,
              participante.status === 'ATIVO'
                ? styles.participantBadgeActive
                : null,
            ]}
          >
            <Text style={styles.participantBadgeText}>
              {participanteStatusLabel[participante.status]}
            </Text>
          </View>
          {isOwnerParticipant ? (
            <View style={styles.participantBadge}>
              <Text style={styles.participantBadgeText}>Proprietário</Text>
            </View>
          ) : null}
        </View>
      </View>
      {canRemove ? (
        <GlassButton
          disabled={disabled}
          label={
            actionLoading
              ? 'Removendo participante...'
              : 'Remover participante'
          }
          onPress={() => onRemove(participante)}
          variant="danger"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  participantAvatar: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  participantBadge: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  participantBadgeActive: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  participantBadgeText: {
    color: FinanceTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  participantBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
    marginTop: FinanceTheme.spacing.xs,
  },
  participantEmail: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  participantInfo: {
    flex: 1,
    minWidth: 0,
  },
  participantInitial: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  participantName: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  participantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
  },
});
