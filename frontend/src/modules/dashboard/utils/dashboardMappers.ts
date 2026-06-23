import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCurrency } from '../../../../utils/formatters';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { DashboardAccent } from '../styles/dashboardTheme';
import {
  DashboardGastoCategoria,
  DashboardMonthlyComparison,
  DashboardResponse,
} from '../types/dashboard';
import { Meta } from '../../metas/types/meta';
import { Orcamento } from '../../orcamentos/types/orcamento';

export type DashboardNavigationItem = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  route: string;
};

export type DashboardMetricItem = {
  accent: DashboardAccent;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
};

export type DashboardMonthlyComparisonItem = {
  accent: DashboardAccent;
  currentFormatted: string;
  differenceFormatted: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  previousFormatted: string;
  status: 'down' | 'stable' | 'up';
  variationLabel: string;
};

export type DashboardMonthlyComparisonOverview = {
  items: DashboardMonthlyComparisonItem[];
  mesAnterior: string;
  mesAtual: string;
};

export type DashboardCategoryBarItem = {
  categoriaId: string;
  categoriaNome: string;
  percentual: number;
  totalFormatado: string;
  widthPercent: number;
};

export type DashboardBudgetOverview = {
  gastoAtualFormatado: string;
  percentualUtilizado: number;
  restanteFormatado: string;
  statusAlerta: Orcamento['statusAlerta'];
  valorPlanejadoFormatado: string;
};

export type DashboardGoalOverview = {
  faltaFormatada: string;
  montoActualFormatado: string;
  montoObjetivoFormatado: string;
  nome: string;
  percentual: number;
};

export const dashboardSidebarItems: DashboardNavigationItem[] = financeSidebarItems;

export function mapDashboardMetrics(
  dashboard: Pick<
    DashboardResponse,
    'despesasMes' | 'economiaMes' | 'receitasMes' | 'saldoTotal'
  >,
): DashboardMetricItem[] {
  return [
    {
      accent: 'cyan',
      icon: 'wallet-outline',
      label: 'Saldo total',
      value: formatCurrency(dashboard.saldoTotal),
    },
    {
      accent: 'cyan',
      icon: 'trending-up',
      label: 'Receitas do mes',
      value: formatCurrency(dashboard.receitasMes),
    },
    {
      accent: 'magenta',
      icon: 'trending-down',
      label: 'Despesas do mes',
      value: formatCurrency(dashboard.despesasMes),
    },
    {
      accent: 'mixed',
      icon: 'piggy-bank-outline',
      label: 'Economia',
      value: formatCurrency(dashboard.economiaMes),
    },
  ];
}

export function mapMonthlyComparison(
  comparison: DashboardMonthlyComparison,
): DashboardMonthlyComparisonOverview {
  return {
    mesAnterior: comparison.mesAnterior,
    mesAtual: comparison.mesAtual,
    items: [
      mapComparisonItem({
        accent: 'cyan',
        icon: 'trending-up',
        label: 'Receitas',
        metric: comparison.receitas,
      }),
      mapComparisonItem({
        accent: 'magenta',
        icon: 'trending-down',
        label: 'Despesas',
        metric: comparison.despesas,
      }),
    ],
  };
}

export function mapCategoryBars(
  items: DashboardGastoCategoria[],
): DashboardCategoryBarItem[] {
  const maxTotal = items.length
    ? Math.max(...items.map((item) => item.total), 1)
    : 1;

  return items.map((item) => ({
    categoriaId: item.categoriaId,
    categoriaNome: item.categoriaNome,
    percentual: item.percentual,
    totalFormatado: formatCurrency(item.total),
    widthPercent: Math.max((item.total / maxTotal) * 100, 4),
  }));
}

export function mapBudgetOverview(
  orcamento: Orcamento | null,
): DashboardBudgetOverview | null {
  if (!orcamento) {
    return null;
  }

  return {
    gastoAtualFormatado: formatCurrency(orcamento.gastoAtual),
    percentualUtilizado: clampPercent(orcamento.percentualUtilizado),
    restanteFormatado: formatCurrency(orcamento.restante),
    statusAlerta: orcamento.statusAlerta,
    valorPlanejadoFormatado: formatCurrency(orcamento.valorPlanejado),
  };
}

export function mapGoalOverview(meta: Meta | null): DashboardGoalOverview | null {
  if (!meta) {
    return null;
  }

  const falta = Math.max(meta.montoObjetivo - meta.montoActual, 0);
  const percentual =
    meta.montoObjetivo > 0 ? (meta.montoActual / meta.montoObjetivo) * 100 : 0;

  return {
    faltaFormatada: formatCurrency(falta),
    montoActualFormatado: formatCurrency(meta.montoActual),
    montoObjetivoFormatado: formatCurrency(meta.montoObjetivo),
    nome: meta.nome,
    percentual: clampPercent(percentual),
  };
}

function mapComparisonItem({
  accent,
  icon,
  label,
  metric,
}: {
  accent: DashboardAccent;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  metric: DashboardMonthlyComparison['receitas'];
}): DashboardMonthlyComparisonItem {
  const status = metric.diferenca > 0 ? 'up' : metric.diferenca < 0 ? 'down' : 'stable';
  const sign = metric.diferenca > 0 ? '+' : '';

  return {
    accent,
    currentFormatted: formatCurrency(metric.atual),
    differenceFormatted: `${sign}${formatCurrency(metric.diferenca)}`,
    icon,
    label,
    previousFormatted: formatCurrency(metric.anterior),
    status,
    variationLabel: `${sign}${metric.percentual.toFixed(2)}% vs mes anterior`,
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}
