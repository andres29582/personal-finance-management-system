import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FinanceAccent, FinanceTheme } from '../../../../shared/styles/financeTheme';
import { SectionCard } from './SectionCard';

type DashboardV2IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type SummaryMetric = { label: string; value: string };

type FinancialSummaryCardProps = {
  accent?: FinanceAccent;
  icon: DashboardV2IconName;
  label: string;
  monthlyMetrics: SummaryMetric[];
  value: string;
};

export function FinancialSummaryCard({
  accent = 'cyan',
  icon,
  label,
  monthlyMetrics,
  value,
}: FinancialSummaryCardProps) {
  const [balanceVisible, setBalanceVisible] = useState(true);

  return (
    <SectionCard accent={accent} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconFrame, accentBackgrounds[accent]]}>
          <MaterialCommunityIcons
            color={accentColors[accent]}
            name={icon}
            size={22}
          />
        </View>
        <Text numberOfLines={1} style={styles.label}>{label}</Text>
      </View>

      <View style={styles.balanceRow}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
          {balanceVisible ? value : '••••••'}
        </Text>
        <Pressable
          accessibilityLabel={balanceVisible ? 'Ocultar saldo' : 'Mostrar saldo'}
          accessibilityRole="button"
          onPress={() => setBalanceVisible((visible) => !visible)}
          style={({ pressed }) => [
            styles.visibilityButton,
            pressed ? styles.visibilityButtonPressed : null,
          ]}
        >
          <MaterialCommunityIcons
            color={FinanceTheme.colors.aquateal[400]}
            name={balanceVisible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
          />
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        {monthlyMetrics.map((metric, index) => (
          <View
            key={metric.label}
            style={[styles.metric, index > 0 ? styles.metricSeparated : null]}
          >
            <Text numberOfLines={1} style={styles.metricLabel}>
              {metric.label}
            </Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>
              {metric.value}
            </Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

const accentColors = {
  cyan: FinanceTheme.colors.cyan,
  magenta: FinanceTheme.colors.magenta,
  mixed: FinanceTheme.colors.violet,
} satisfies Record<FinanceAccent, string>;

const styles = StyleSheet.create({
  card: {
    minWidth: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
  },
  balanceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.xs,
    marginTop: FinanceTheme.spacing.xs,
  },
  label: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: FinanceTheme.radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  metricsRow: {
    borderTopColor: FinanceTheme.colors.border,
    borderTopWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    marginTop: FinanceTheme.spacing.md,
    paddingTop: FinanceTheme.spacing.sm,
  },
  value: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.hero,
    fontWeight: '900',
    lineHeight: 40,
    minWidth: 0,
  },
  visibilityButton: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  visibilityButtonPressed: {
    opacity: FinanceTheme.opacity.pressed,
  },
  metric: {
    flex: 1,
    gap: FinanceTheme.spacing.xxs,
    minWidth: 0,
    paddingHorizontal: FinanceTheme.spacing.xs,
  },
  metricLabel: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '700',
  },
  metricValue: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  metricSeparated: {
    borderLeftColor: FinanceTheme.colors.border,
    borderLeftWidth: FinanceTheme.borderWidth.hairline,
  },
});
const accentBackgrounds = StyleSheet.create({
  cyan: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
  },
  magenta: {
    backgroundColor: FinanceTheme.colors.magentaSoft,
  },
  mixed: {
    backgroundColor: 'rgba(183, 140, 255, 0.18)',
  },
});
