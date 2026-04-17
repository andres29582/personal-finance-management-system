import { ReactNode } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ContaTheme } from '../constants/contas-theme';
import { AppButton } from './app-button';

type AppScreenProps = {
  actionLabel?: string;
  backLabel?: string;
  children: ReactNode;
  headerStart?: ReactNode;
  onBackPress?: () => void;
  onActionPress?: () => void;
  subtitle?: string;
  title: string;
};

export function AppScreen({
  actionLabel,
  backLabel,
  children,
  headerStart,
  onBackPress,
  onActionPress,
  subtitle,
  title,
}: AppScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerPrimary}>
            {backLabel && onBackPress ? (
              <TouchableOpacity onPress={onBackPress} style={[styles.actionButton, styles.backButton]}>
                <Text style={styles.actionButtonText}>{backLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {headerStart ? <View style={styles.headerStart}>{headerStart}</View> : null}
            <View style={styles.headerTextBox}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          {actionLabel && onActionPress ? (
            <TouchableOpacity onPress={onActionPress} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>{actionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AppCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function AppStatusCard({
  actionLabel,
  description,
  loading = false,
  onActionPress,
  title,
  tone = 'muted',
}: {
  actionLabel?: string;
  description?: string;
  loading?: boolean;
  onActionPress?: () => void;
  title: string;
  tone?: 'error' | 'muted' | 'success';
}) {
  return (
    <View style={[styles.card, styles.statusCard, statusToneStyles[tone]]}>
      {loading ? (
        <ActivityIndicator
          color={ContaTheme.colors.primary}
          size="large"
          style={styles.statusSpinner}
        />
      ) : null}
      <Text style={styles.statusTitle}>{title}</Text>
      {description ? <Text style={styles.statusDescription}>{description}</Text> : null}
      {actionLabel && onActionPress ? (
        <View style={styles.statusAction}>
          <AppButton label={actionLabel} onPress={onActionPress} variant="ghost" />
        </View>
      ) : null}
    </View>
  );
}

export function AppField({
  children,
  error,
  label,
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export const appInputStyles = StyleSheet.create({
  input: {
    backgroundColor: '#FAFAFA',
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.md,
    borderWidth: 1,
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    height: 48,
    paddingHorizontal: ContaTheme.spacing.sm,
  },
  inputError: {
    borderColor: ContaTheme.colors.error,
  },
  multiline: {
    height: 96,
    paddingTop: ContaTheme.spacing.sm,
    textAlignVertical: 'top',
  },
});

const styles = StyleSheet.create({
  actionButton: {
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.md,
    borderWidth: 1,
    paddingHorizontal: ContaTheme.spacing.md,
    paddingVertical: ContaTheme.spacing.xs,
  },
  actionButtonText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '600',
  },
  card: {
    backgroundColor: ContaTheme.colors.surface,
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.lg,
    borderWidth: 1,
    marginBottom: ContaTheme.spacing.md,
    padding: ContaTheme.spacing.md,
  },
  content: {
    padding: ContaTheme.spacing.lg,
    paddingBottom: ContaTheme.spacing.xl,
  },
  backButton: {
    marginRight: ContaTheme.spacing.sm,
  },
  field: {
    marginBottom: ContaTheme.spacing.sm,
  },
  fieldError: {
    color: ContaTheme.colors.error,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '600',
    marginTop: ContaTheme.spacing.xs,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: ContaTheme.spacing.md,
  },
  headerPrimary: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  headerStart: {
    marginRight: ContaTheme.spacing.sm,
  },
  headerTextBox: {
    flex: 1,
    marginRight: ContaTheme.spacing.md,
  },
  label: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '700',
    marginBottom: ContaTheme.spacing.xs,
  },
  screen: {
    backgroundColor: ContaTheme.colors.screenBg,
    flex: 1,
  },
  statusAction: {
    marginTop: ContaTheme.spacing.sm,
    width: '100%',
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: ContaTheme.spacing.lg,
  },
  statusDescription: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.body,
    marginTop: ContaTheme.spacing.xs,
    textAlign: 'center',
  },
  statusSpinner: {
    marginBottom: ContaTheme.spacing.sm,
  },
  statusTitle: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xxs,
  },
  title: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.heading,
    fontWeight: '700',
  },
});

const statusToneStyles = StyleSheet.create({
  error: {
    backgroundColor: '#FFF4F3',
    borderColor: '#F3C0BE',
  },
  muted: {
    backgroundColor: ContaTheme.colors.surface,
    borderColor: ContaTheme.colors.border,
  },
  success: {
    backgroundColor: '#EFF8EF',
    borderColor: '#CBE3CD',
  },
});
