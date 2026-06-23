import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DashboardTheme } from '../styles/dashboardTheme';
import { DashboardMonthlyComparisonOverview } from '../utils/dashboardMappers';
import { GlassPanel } from './GlassPanel';

type MonthlyComparisonCardProps = {
  comparison: DashboardMonthlyComparisonOverview;
};

export function MonthlyComparisonCard({
  comparison,
}: MonthlyComparisonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const expenses = comparison.items.find((item) => item.label === 'Despesas');

  return (
    <GlassPanel
      accessibilityLabel="Alternar comparativo de gastos"
      accent="magenta"
      subtitle={`${comparison.mesAtual} comparado com ${comparison.mesAnterior}`}
      title="Comparativo de gastos"
      onPress={() => setExpanded((current) => !current)}
    >
      {expanded && expenses ? (
        <View style={styles.item}>
            <View style={styles.itemHeader}>
              <View
                style={[
                  styles.iconBox,
                  expenses.accent === 'magenta'
                    ? styles.magentaIcon
                    : styles.cyanIcon,
                ]}
              >
                <MaterialCommunityIcons
                  color={
                    expenses.accent === 'magenta'
                      ? DashboardTheme.colors.magenta
                      : DashboardTheme.colors.cyan
                  }
                  name={expenses.icon}
                  size={20}
                />
              </View>
              <View style={styles.titleGroup}>
                <Text style={styles.label}>Gastos do mes</Text>
                <Text
                  style={[
                    styles.variation,
                    expenses.status === 'up' ? styles.up : null,
                    expenses.status === 'down' ? styles.down : null,
                  ]}
                >
                  {expenses.variationLabel}
                </Text>
              </View>
            </View>

            <View style={styles.valuesRow}>
              <View style={styles.valueBlock}>
                <Text style={styles.caption}>Mes atual</Text>
                <Text style={styles.value}>{expenses.currentFormatted}</Text>
              </View>
              <View style={styles.valueBlock}>
                <Text style={styles.caption}>Mes anterior</Text>
                <Text style={styles.previousValue}>
                  {expenses.previousFormatted}
                </Text>
              </View>
              <View style={styles.valueBlock}>
                <Text style={styles.caption}>Diferenca</Text>
                <Text
                  style={[
                    styles.previousValue,
                    expenses.status === 'up' ? styles.up : null,
                    expenses.status === 'down' ? styles.down : null,
                  ]}
                >
                  {expenses.differenceFormatted}
                </Text>
              </View>
            </View>
          </View>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  caption: {
    color: DashboardTheme.colors.textSubtle,
    fontSize: DashboardTheme.typography.caption,
    fontWeight: '700',
  },
  cyanIcon: {
    backgroundColor: DashboardTheme.colors.cyanSoft,
    borderColor: DashboardTheme.neon.cyan.borderColor,
  },
  down: {
    color: DashboardTheme.colors.danger,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: DashboardTheme.radius.md,
    borderWidth: DashboardTheme.borderWidth.hairline,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  item: {
    backgroundColor: DashboardTheme.colors.glassSubtle,
    borderColor: DashboardTheme.colors.border,
    borderRadius: DashboardTheme.radius.md,
    borderWidth: DashboardTheme.borderWidth.hairline,
    flex: 1,
    gap: DashboardTheme.spacing.md,
    minWidth: 280,
    padding: DashboardTheme.spacing.md,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DashboardTheme.spacing.sm,
  },
  label: {
    color: DashboardTheme.colors.text,
    fontSize: DashboardTheme.typography.body,
    fontWeight: '900',
  },
  magentaIcon: {
    backgroundColor: DashboardTheme.colors.magentaSoft,
    borderColor: DashboardTheme.neon.magenta.borderColor,
  },
  previousValue: {
    color: DashboardTheme.colors.textMuted,
    fontSize: DashboardTheme.typography.body,
    fontWeight: '800',
  },
  titleGroup: {
    flex: 1,
    gap: DashboardTheme.spacing.xxs,
    minWidth: 0,
  },
  up: {
    color: DashboardTheme.colors.success,
  },
  value: {
    color: DashboardTheme.colors.text,
    fontSize: DashboardTheme.typography.heading,
    fontWeight: '900',
  },
  valueBlock: {
    flex: 1,
    gap: DashboardTheme.spacing.xxs,
    minWidth: 120,
  },
  valuesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DashboardTheme.spacing.md,
  },
  variation: {
    color: DashboardTheme.colors.textMuted,
    fontSize: DashboardTheme.typography.caption,
    fontWeight: '800',
  },
});
