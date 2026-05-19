import { DimensionValue, StyleSheet, Text, View } from 'react-native';
import { DashboardTheme } from '../styles/dashboardTheme';
import { DashboardGoalOverview } from '../utils/dashboardMappers';
import { GlassPanel } from './GlassPanel';
import { NeonIconButton } from './NeonIconButton';

type GoalProgressCardProps = {
  goal: DashboardGoalOverview | null;
  onOpenGoals: () => void;
};

export function GoalProgressCard({ goal, onOpenGoals }: GoalProgressCardProps) {
  const progressWidth: DimensionValue = `${goal?.percentual ?? 0}%`;

  return (
    <GlassPanel
      accent="magenta"
      title="Meta em destaque"
      action={
        <NeonIconButton
          accent="magenta"
          icon="bullseye-arrow"
          label="Metas"
          onPress={onOpenGoals}
        />
      }
      style={styles.card}
    >
      {goal ? (
        <View style={styles.content}>
          <Text style={styles.goalName}>{goal.nome}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Guardado</Text>
            <Text style={styles.value}>{goal.montoActualFormatado}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Objetivo</Text>
            <Text style={styles.value}>{goal.montoObjetivoFormatado}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: progressWidth }]} />
          </View>
          <Text style={styles.meta}>
            Falta {goal.faltaFormatada} · {goal.percentual}% completo
          </Text>
        </View>
      ) : (
        <Text style={styles.empty}>Nenhuma meta ativa cadastrada.</Text>
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
    backgroundColor: DashboardTheme.colors.magenta,
    borderRadius: DashboardTheme.radius.xs,
    height: '100%',
    minWidth: 6,
  },
  goalName: {
    color: DashboardTheme.colors.text,
    fontSize: DashboardTheme.typography.heading,
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
