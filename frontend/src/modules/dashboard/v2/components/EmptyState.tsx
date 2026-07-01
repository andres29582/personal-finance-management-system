import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { SectionCard } from './SectionCard';

type DashboardV2IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type EmptyStateProps = {
  actionLabel?: string;
  description?: string;
  icon?: DashboardV2IconName;
  onActionPress?: () => void;
  title: string;
  tone?: 'error' | 'muted' | 'success';
};

export function EmptyState({
  actionLabel,
  description,
  icon = 'chart-box-outline',
  onActionPress,
  title,
  tone = 'muted',
}: EmptyStateProps) {
  return (
    <SectionCard compact style={styles.card}>
      <View style={[styles.iconFrame, toneStyles[tone]]}>
        <MaterialCommunityIcons color={toneColors[tone]} name={icon} size={28} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.actionButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </SectionCard>
  );
}

const toneColors = {
  error: FinanceTheme.colors.danger,
  muted: FinanceTheme.colors.cyanMuted,
  success: FinanceTheme.colors.success,
};

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    justifyContent: 'center',
    marginTop: FinanceTheme.spacing.md,
    minHeight: 42,
    paddingHorizontal: FinanceTheme.spacing.md,
  },
  actionText: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.button,
    fontWeight: '800',
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    padding: FinanceTheme.spacing.lg,
  },
  description: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 20,
    marginTop: FinanceTheme.spacing.xs,
    maxWidth: 420,
    textAlign: 'center',
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: FinanceTheme.radius.lg,
    height: 56,
    justifyContent: 'center',
    marginBottom: FinanceTheme.spacing.md,
    width: 56,
  },
  pressed: {
    opacity: FinanceTheme.opacity.pressed,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
});

const toneStyles = StyleSheet.create({
  error: {
    backgroundColor: 'rgba(255, 122, 144, 0.14)',
  },
  muted: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
  },
  success: {
    backgroundColor: 'rgba(61, 220, 151, 0.14)',
  },
});
