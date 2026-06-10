import { StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { formatCurrency } from '../../../../utils/formatters';

type DespesaCategoria = {
  categoriaNome: string;
  percentual: number;
  total: number;
};

type Props = {
  despesasPorCategoria: DespesaCategoria[];
  totalDespesas: number;
  totalReceitas: number;
};

export function RelatorioGestaoCharts({
  despesasPorCategoria,
  totalDespesas,
  totalReceitas,
}: Props) {
  const totalMov = totalReceitas + totalDespesas;
  const receitaWidth =
    totalMov > 0 ? Math.round((totalReceitas / totalMov) * 100) : 50;
  const despesaWidth = totalMov > 0 ? 100 - receitaWidth : 50;
  const topDespesas = despesasPorCategoria.slice(0, 8);
  const maxBar =
    topDespesas.length > 0
      ? Math.max(...topDespesas.map((item) => item.total), 1)
      : 1;

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Receitas x despesas (periodo)</Text>
      <View style={styles.stackedBar}>
        <View
          style={[
            styles.stackedSegment,
            styles.segmentReceita,
            { flex: Math.max(receitaWidth, 1) },
          ]}
        />
        <View
          style={[
            styles.stackedSegment,
            styles.segmentDespesa,
            { flex: Math.max(despesaWidth, 1) },
          ]}
        />
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendReceita}>
          Receitas {formatCurrency(totalReceitas)}
        </Text>
        <Text style={styles.legendDespesa}>
          Despesas {formatCurrency(totalDespesas)}
        </Text>
      </View>

      <Text style={[styles.sectionTitle, styles.marginTop]}>
        Despesas por categoria (barras)
      </Text>
      {topDespesas.length ? (
        topDespesas.map((item) => {
          const pct = Math.round((item.total / maxBar) * 100);

          return (
            <View key={item.categoriaNome} style={styles.barRow}>
              <Text style={styles.barLabel} numberOfLines={1}>
                {item.categoriaNome}
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.barValue}>{formatCurrency(item.total)}</Text>
            </View>
          );
        })
      ) : (
        <Text style={styles.empty}>Sem despesas para grafico neste periodo.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  barFill: {
    backgroundColor: FinanceTheme.colors.magenta,
    borderRadius: 4,
    height: '100%',
    minWidth: 4,
  },
  barLabel: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    marginRight: FinanceTheme.spacing.xs,
  },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: FinanceTheme.spacing.sm,
  },
  barTrack: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderRadius: 4,
    flex: 2,
    height: 10,
    marginRight: FinanceTheme.spacing.xs,
    overflow: 'hidden',
  },
  barValue: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    minWidth: 88,
    textAlign: 'right',
  },
  empty: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.body,
    marginTop: FinanceTheme.spacing.xs,
  },
  legendDespesa: {
    color: FinanceTheme.colors.magenta,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    textAlign: 'right',
  },
  legendReceita: {
    color: FinanceTheme.colors.cyanMuted,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: FinanceTheme.spacing.xs,
  },
  marginTop: {
    marginTop: FinanceTheme.spacing.lg,
  },
  sectionTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
  },
  segmentDespesa: {
    backgroundColor: FinanceTheme.colors.magenta,
  },
  segmentReceita: {
    backgroundColor: FinanceTheme.colors.cyan,
  },
  stackedBar: {
    borderRadius: 8,
    flexDirection: 'row',
    height: 22,
    marginTop: FinanceTheme.spacing.sm,
    overflow: 'hidden',
  },
  stackedSegment: {
    height: '100%',
  },
  wrap: {
    marginTop: FinanceTheme.spacing.md,
  },
});
