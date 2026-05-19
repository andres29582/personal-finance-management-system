import { StyleSheet, View } from 'react-native';
import { DashboardTheme } from '../styles/dashboardTheme';
import {
  DashboardBudgetOverview,
  DashboardGoalOverview,
} from '../utils/dashboardMappers';
import { BudgetOverviewCard } from './BudgetOverviewCard';
import { GoalProgressCard } from './GoalProgressCard';

type PlanningOverviewGridProps = {
  budget: DashboardBudgetOverview | null;
  goal: DashboardGoalOverview | null;
  onOpenBudgets: () => void;
  onOpenGoals: () => void;
};

export function PlanningOverviewGrid({
  budget,
  goal,
  onOpenBudgets,
  onOpenGoals,
}: PlanningOverviewGridProps) {
  return (
    <View style={styles.grid}>
      <BudgetOverviewCard budget={budget} onOpenBudgets={onOpenBudgets} />
      <GoalProgressCard goal={goal} onOpenGoals={onOpenGoals} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DashboardTheme.spacing.md,
  },
});
