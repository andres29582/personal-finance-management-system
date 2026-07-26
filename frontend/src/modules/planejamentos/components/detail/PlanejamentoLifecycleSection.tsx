import { StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { GlassButton, GlassPanel } from '../../../../shared/ui';
import { PlanejamentoStatus } from '../../types/planejamento';

export type PlanejamentoTransition = 'archive' | 'cancel' | 'close';

type PlanejamentoLifecycleSectionProps = {
  errorMessage: string;
  infoMessage: string;
  isFinanciallySettled: boolean;
  loadingLabel: string;
  mutationInProgress: boolean;
  onTransition: (transition: PlanejamentoTransition) => void | Promise<void>;
  status: PlanejamentoStatus;
  transitionLoading: PlanejamentoTransition | null;
};

export function PlanejamentoLifecycleSection({
  errorMessage,
  infoMessage,
  isFinanciallySettled,
  loadingLabel,
  mutationInProgress,
  onTransition,
  status,
  transitionLoading,
}: PlanejamentoLifecycleSectionProps) {
  const isReadOnly = status === 'ARQUIVADO' || status === 'CANCELADO';

  return (
    <GlassPanel
      title="Ciclo de vida"
      subtitle="Acoes disponiveis para o estado atual do planejamento."
    >
      {errorMessage ? (
        <Text style={styles.actionError}>{errorMessage}</Text>
      ) : null}
      {infoMessage ? (
        <Text style={styles.actionInfo}>{infoMessage}</Text>
      ) : null}

      {status === 'ABERTO' ? (
        <>
          <View style={styles.lifecycleActions}>
            <GlassButton
              disabled={mutationInProgress}
              label={
                transitionLoading === 'close'
                  ? loadingLabel
                  : 'Fechar planejamento'
              }
              onPress={() => void onTransition('close')}
              variant="primary"
            />
            <GlassButton
              disabled={mutationInProgress || !isFinanciallySettled}
              label={
                transitionLoading === 'cancel'
                  ? loadingLabel
                  : 'Cancelar planejamento'
              }
              onPress={() => void onTransition('cancel')}
              variant="danger"
            />
          </View>
          {!isFinanciallySettled ? (
            <Text style={styles.lifecycleHint}>
              O cancelamento fica disponivel quando a situacao financeira
              estiver quitada.
            </Text>
          ) : null}
        </>
      ) : null}

      {status === 'FECHADO' ? (
        <>
          <View style={styles.lifecycleActions}>
            <GlassButton
              disabled={mutationInProgress || !isFinanciallySettled}
              label={
                transitionLoading === 'archive'
                  ? loadingLabel
                  : 'Arquivar planejamento'
              }
              onPress={() => void onTransition('archive')}
              variant="primary"
            />
          </View>
          {!isFinanciallySettled ? (
            <Text style={styles.lifecycleHint}>
              Quite a obrigacao residual para arquivar o planejamento.
            </Text>
          ) : null}
        </>
      ) : null}

      {isReadOnly ? (
        <Text style={styles.readOnlyText}>
          Este planejamento esta em modo somente leitura.
        </Text>
      ) : null}
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
  lifecycleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
  },
  lifecycleHint: {
    color: FinanceTheme.colors.warning,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.sm,
  },
  readOnlyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
});
