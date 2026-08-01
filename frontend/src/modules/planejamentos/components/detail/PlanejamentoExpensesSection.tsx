import { StyleSheet, Text } from 'react-native';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { GlassButton, GlassPanel } from '../../../../shared/ui';
import {
  GastoPlanejamento,
  ParticipantePlanejamento,
} from '../../types/planejamento';
import { GastoRow } from './GastoRow';

type PlanejamentoExpensesSectionProps = {
  actionLoadingId: string | null;
  canCancelExpense: (gasto: GastoPlanejamento) => boolean;
  canCreateExpense: boolean;
  canEditExpense: (gasto: GastoPlanejamento) => boolean;
  errorMessage: string;
  gastos: GastoPlanejamento[];
  infoMessage: string;
  mutationInProgress: boolean;
  onAdd: () => void;
  onCancel: (gasto: GastoPlanejamento) => void;
  onEdit: (gasto: GastoPlanejamento) => void;
  participantes: ParticipantePlanejamento[];
};

export function PlanejamentoExpensesSection({
  actionLoadingId,
  canCancelExpense,
  canCreateExpense,
  canEditExpense,
  errorMessage,
  gastos,
  infoMessage,
  mutationInProgress,
  onAdd,
  onCancel,
  onEdit,
  participantes,
}: PlanejamentoExpensesSectionProps) {
  return (
    <GlassPanel
      title="Gastos"
      subtitle="Despesas compartilhadas deste planejamento."
      action={
        canCreateExpense ? (
          <GlassButton
            disabled={mutationInProgress}
            label="Adicionar gasto"
            onPress={onAdd}
            variant="ghost"
          />
        ) : undefined
      }
    >
      {errorMessage ? (
        <Text style={styles.gastosError}>{errorMessage}</Text>
      ) : null}
      {infoMessage ? (
        <Text style={styles.gastosInfo}>{infoMessage}</Text>
      ) : null}

      {gastos.length ? (
        gastos.map((gasto) => (
          <GastoRow
            key={gasto.id}
            actionLoading={actionLoadingId === gasto.id}
            canCancel={canCancelExpense(gasto)}
            canEdit={canEditExpense(gasto)}
            disabled={mutationInProgress}
            gasto={gasto}
            onCancel={onCancel}
            onEdit={onEdit}
            participantes={participantes}
          />
        ))
      ) : (
        <Text style={styles.emptyText}>Nenhum gasto cadastrado.</Text>
      )}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  gastosError: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  gastosInfo: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
});
