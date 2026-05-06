import { StyleSheet, Text, View } from 'react-native';
import { ContaTheme } from '../constants/contas-theme';
import { formatCurrency } from '../utils/formatters';

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
    backgroundColor: ContaTheme.colors.primaryStrong,
    borderRadius: 4,
    height: '100%',
    minWidth: 4,
  },
  barLabel: {
    color: ContaTheme.colors.title,
    flex: 1,
    fontSize: ContaTheme.typography.caption,
    marginRight: ContaTheme.spacing.xs,
  },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: ContaTheme.spacing.sm,
  },
  barTrack: {
    backgroundColor: ContaTheme.colors.border,
    borderRadius: 4,
    flex: 2,
    height: 10,
    marginRight: ContaTheme.spacing.xs,
    overflow: 'hidden',
  },
  barValue: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    minWidth: 88,
    textAlign: 'right',
  },
  empty: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.body,
    marginTop: ContaTheme.spacing.xs,
  },
  legendDespesa: {
    color: ContaTheme.colors.primaryStrong,
    flex: 1,
    fontSize: ContaTheme.typography.caption,
    textAlign: 'right',
  },
  legendReceita: {
    color: ContaTheme.colors.primary,
    flex: 1,
    fontSize: ContaTheme.typography.caption,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: ContaTheme.spacing.xs,
  },
  marginTop: {
    marginTop: ContaTheme.spacing.lg,
  },
  sectionTitle: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
  },
  segmentDespesa: {
    backgroundColor: ContaTheme.colors.primaryStrong,
  },
  segmentReceita: {
    backgroundColor: ContaTheme.colors.primary,
  },
  stackedBar: {
    borderRadius: 8,
    flexDirection: 'row',
    height: 22,
    marginTop: ContaTheme.spacing.sm,
    overflow: 'hidden',
  },
  stackedSegment: {
    height: '100%',
  },
  wrap: {
    marginTop: ContaTheme.spacing.md,
  },
});
