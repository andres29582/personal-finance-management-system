import { StyleSheet, View } from 'react-native';
import { DashboardTheme } from '../styles/dashboardTheme';
import { DashboardMetricItem } from '../utils/dashboardMappers';
import { FinancialSummaryCard } from '../v2/components';

type FinancialSummaryGridProps = {
  metrics: DashboardMetricItem[];
};

export function FinancialSummaryGrid({ metrics }: FinancialSummaryGridProps) {
  return (
    <View style={styles.grid}>
      {metrics.map((metric) => (
        <FinancialSummaryCard
          key={metric.label}
          accent={metric.accent}
          icon={metric.icon}
          label={metric.label}
          value={metric.value}
        />
      ))}
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
