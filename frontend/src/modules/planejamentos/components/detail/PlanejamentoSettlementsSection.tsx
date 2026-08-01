import { StyleSheet, Text } from 'react-native';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { GlassButton, GlassPanel } from '../../../../shared/ui';
import {
  AcertoPlanejamento,
  ParticipantePlanejamento,
} from '../../types/planejamento';
import { AcertoAction, AcertoRow } from './AcertoRow';

type PlanejamentoSettlementsSectionProps = {
  acertos: AcertoPlanejamento[];
  actionLoadingId: string | null;
  canPerformSettlementAction: (
    acerto: AcertoPlanejamento,
    action: AcertoAction,
  ) => boolean;
  canSyncSettlements: boolean;
  errorMessage: string;
  infoMessage: string;
  isReadOnly: boolean;
  mutationInProgress: boolean;
  onAction: (acerto: AcertoPlanejamento, action: AcertoAction) => void;
  onSync: () => void;
  participantes: ParticipantePlanejamento[];
};

export function PlanejamentoSettlementsSection({
  acertos,
  actionLoadingId,
  canPerformSettlementAction,
  canSyncSettlements,
  errorMessage,
  infoMessage,
  isReadOnly,
  mutationInProgress,
  onAction,
  onSync,
  participantes,
}: PlanejamentoSettlementsSectionProps) {
  return (
    <GlassPanel
      title="Acertos"
      subtitle="Pagamentos calculados entre participantes."
      action={
        canSyncSettlements ? (
          <GlassButton
            disabled={mutationInProgress}
            label={
              actionLoadingId === 'sync'
                ? 'Sincronizando...'
                : 'Sincronizar acertos'
            }
            onPress={onSync}
            variant="ghost"
          />
        ) : undefined
      }
    >
      {errorMessage ? (
        <Text style={styles.acertosError}>{errorMessage}</Text>
      ) : null}
      {infoMessage ? (
        <Text style={styles.acertosInfo}>{infoMessage}</Text>
      ) : null}

      {acertos.length ? (
        acertos.map((acerto) => (
          <AcertoRow
            key={acerto.id}
            acerto={acerto}
            actionLoading={actionLoadingId}
            canPerformSettlementAction={canPerformSettlementAction}
            disabled={mutationInProgress}
            onAction={onAction}
            participantes={participantes}
          />
        ))
      ) : (
        <Text style={styles.emptyText}>
          {isReadOnly
            ? 'Nenhum acerto registrado.'
            : 'Nenhum acerto encontrado. Cadastre gastos e participantes ativos para calcular os acertos.'}
        </Text>
      )}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  acertosError: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  acertosInfo: {
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
