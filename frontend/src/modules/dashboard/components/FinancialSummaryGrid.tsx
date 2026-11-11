import { DashboardMetricItem } from '../utils/dashboardMappers';
import { FinancialSummaryCard } from '../v2/components';

type FinancialSummaryGridProps = {
  metrics: DashboardMetricItem[];
};

export function FinancialSummaryGrid({ metrics }: FinancialSummaryGridProps) {
  const [balance, ...monthlyMetrics] = metrics;
  if (!balance) return null;

  return (
    <FinancialSummaryCard
      accent="cyan"
      icon={balance.icon}
      label={balance.label}
      monthlyMetrics={monthlyMetrics.map((metric) => ({
        label: metric.label === 'Economia' ? 'Resultado' : metric.label.replace(' do mes', ''),
        value: metric.value,
      }))}
      value={balance.value}
    />
  );
}
