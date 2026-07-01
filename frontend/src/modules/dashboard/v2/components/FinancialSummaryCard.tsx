import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { FinanceAccent, FinanceTheme } from '../../../../shared/styles/financeTheme';
import { SectionCard } from './SectionCard';

type DashboardV2IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type FinancialSummaryCardProps = {
  accent?: FinanceAccent;
  helperText?: string;
  icon: DashboardV2IconName;
  label: string;
  trendLabel?: string;
  trendTone?: 'negative' | 'neutral' | 'positive';
  value: string;
};

export function FinancialSummaryCard({
  accent = 'cyan',
  helperText,
  icon,
  label,
  trendLabel,
  trendTone = 'neutral',
  value,
}: FinancialSummaryCardProps) {
  return (
    <SectionCard accent={accent} compact style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconFrame, accentBackgrounds[accent]]}>
          <MaterialCommunityIcons
            color={accentColors[accent]}
            name={icon}
            size={22}
          />
        </View>
        {trendLabel ? (
          <View style={[styles.trendPill, trendStyles[trendTone]]}>
            <Text style={[styles.trendText, trendTextStyles[trendTone]]}>
              {trendLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
        {value}
      </Text>
      {helperText ? (
        <Text numberOfLines={2} style={styles.helperText}>
          {helperText}
        </Text>
      ) : null}
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
    minHeight: 156,
    minWidth: 220,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.md,
  },
  helperText: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 18,
    marginTop: FinanceTheme.spacing.xs,
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: FinanceTheme.radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  label: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.xs,
  },
  trendPill: {
    borderRadius: FinanceTheme.radius.sm,
    paddingHorizontal: FinanceTheme.spacing.xs,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  trendText: {
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '800',
  },
  value: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.heading,
    fontWeight: '900',
    lineHeight: 26,
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

const trendStyles = StyleSheet.create({
  negative: {
    backgroundColor: 'rgba(255, 122, 144, 0.14)',
  },
  neutral: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
  },
  positive: {
    backgroundColor: 'rgba(61, 220, 151, 0.14)',
  },
});

const trendTextStyles = StyleSheet.create({
  negative: {
    color: FinanceTheme.colors.danger,
  },
  neutral: {
    color: FinanceTheme.colors.textMuted,
  },
  positive: {
    color: FinanceTheme.colors.success,
  },
});
