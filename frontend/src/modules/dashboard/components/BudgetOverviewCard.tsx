import { DimensionValue, StyleSheet, Text, View } from 'react-native';
import { DashboardTheme } from '../styles/dashboardTheme';
import { DashboardBudgetOverview } from '../utils/dashboardMappers';
import { GlassPanel } from './GlassPanel';
import { NeonIconButton } from './NeonIconButton';

type BudgetOverviewCardProps = {
  budget: DashboardBudgetOverview | null;
  onOpenBudgets: () => void;
};

export function BudgetOverviewCard({
  budget,
  onOpenBudgets,
}: BudgetOverviewCardProps) {
  const progressWidth: DimensionValue = `${budget?.percentualUtilizado ?? 0}%`;

  return (
    <GlassPanel
      accent="mixed"
      title="Orcamento do mes"
      action={
        <NeonIconButton
          accent="mixed"
          icon="cash-multiple"
          label="Orcamentos"
          onPress={onOpenBudgets}
        />
      }
      style={styles.card}
    >
      {budget ? (
        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={styles.label}>Definido</Text>
            <Text style={styles.value}>{budget.valorPlanejadoFormatado}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Gasto</Text>
            <Text style={styles.value}>{budget.gastoAtualFormatado}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Restante</Text>
            <Text style={styles.highlight}>{budget.restanteFormatado}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: progressWidth }]} />
          </View>
          <Text style={styles.meta}>
            {budget.percentualUtilizado}% utilizado · {budget.statusAlerta}
          </Text>
        </View>
      ) : (
        <Text style={styles.empty}>
          Nenhum orcamento definido para este mes.
        </Text>
      )}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 280,
  },
  content: {
    gap: DashboardTheme.spacing.sm,
  },
  empty: {
    color: DashboardTheme.colors.textMuted,
    fontSize: DashboardTheme.typography.body,
  },
  fill: {
    backgroundColor: DashboardTheme.colors.cyan,
    borderRadius: DashboardTheme.radius.xs,
    height: '100%',
    minWidth: 6,
  },
  highlight: {
    color: DashboardTheme.colors.success,
    fontSize: DashboardTheme.typography.body,
    fontWeight: '900',
  },
  label: {
    color: DashboardTheme.colors.textMuted,
    fontSize: DashboardTheme.typography.caption,
    fontWeight: '700',
  },
  meta: {
    color: DashboardTheme.colors.textSubtle,
    fontSize: DashboardTheme.typography.caption,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    backgroundColor: DashboardTheme.colors.glassSubtle,
    borderRadius: DashboardTheme.radius.xs,
    height: 10,
    overflow: 'hidden',
  },
  value: {
    color: DashboardTheme.colors.text,
    fontSize: DashboardTheme.typography.body,
    fontWeight: '800',
  },
});
