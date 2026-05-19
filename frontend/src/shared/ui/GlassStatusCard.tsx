import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../styles/financeTheme';
import { GlassButton } from './GlassButton';
import { GlassPanel } from './GlassPanel';

type GlassStatusCardProps = {
  actionLabel?: string;
  description?: string;
  loading?: boolean;
  onActionPress?: () => void;
  title: string;
  tone?: 'error' | 'muted' | 'success';
};

export function GlassStatusCard({
  actionLabel,
  description,
  loading = false,
  onActionPress,
  title,
  tone = 'muted',
}: GlassStatusCardProps) {
  return (
    <GlassPanel accent={tone === 'error' ? 'magenta' : 'mixed'}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={FinanceTheme.colors.cyan}
            size="large"
            style={styles.spinner}
          />
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {actionLabel && onActionPress ? (
          <View style={styles.action}>
            <GlassButton
              label={actionLabel}
              onPress={onActionPress}
              variant={tone === 'error' ? 'danger' : 'ghost'}
            />
          </View>
        ) : null}
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: FinanceTheme.spacing.sm,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    paddingVertical: FinanceTheme.spacing.lg,
  },
  description: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.body,
    marginTop: FinanceTheme.spacing.xs,
    textAlign: 'center',
  },
  spinner: {
    marginBottom: FinanceTheme.spacing.sm,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
    textAlign: 'center',
  },
});
