import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { SectionCard } from './SectionCard';

type DashboardV2IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type InsightCardProps = {
  description: string;
  icon?: DashboardV2IconName;
  title: string;
  tone?: 'danger' | 'info' | 'success' | 'warning';
  value?: string;
};

export function InsightCard({
  description,
  icon = 'lightbulb-on-outline',
  title,
  tone = 'info',
  value,
}: InsightCardProps) {
  return (
    <SectionCard compact style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconFrame, toneStyles[tone]]}>
          <MaterialCommunityIcons color={toneColors[tone]} name={icon} size={20} />
        </View>
        <View style={styles.titleGroup}>
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {value ? (
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>
              {value}
            </Text>
          ) : null}
        </View>
      </View>
      <Text numberOfLines={3} style={styles.description}>
        {description}
      </Text>
    </SectionCard>
  );
}

const toneColors = {
  danger: FinanceTheme.colors.danger,
  info: FinanceTheme.colors.cyan,
  success: FinanceTheme.colors.success,
  warning: FinanceTheme.colors.warning,
};

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
    minWidth: 220,
  },
  description: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 19,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: FinanceTheme.radius.sm,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    lineHeight: 18,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
  },
  value: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '800',
    marginTop: FinanceTheme.spacing.xxs,
  },
});

const toneStyles = StyleSheet.create({
  danger: {
    backgroundColor: 'rgba(255, 122, 144, 0.14)',
  },
  info: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
  },
  success: {
    backgroundColor: 'rgba(61, 220, 151, 0.14)',
  },
  warning: {
    backgroundColor: 'rgba(255, 210, 87, 0.14)',
  },
});
