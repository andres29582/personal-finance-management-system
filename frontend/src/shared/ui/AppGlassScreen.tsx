import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FinanceTheme } from '../styles/financeTheme';

type AppGlassScreenProps = {
  action?: ReactNode;
  children: ReactNode;
  subtitle?: string;
  title: string;
};

export function AppGlassScreen({
  action,
  children,
  subtitle,
  title,
}: AppGlassScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  action: {
    marginLeft: FinanceTheme.spacing.sm,
  },
  content: {
    padding: FinanceTheme.spacing.lg,
    paddingBottom: FinanceTheme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.lg,
  },
  safeArea: {
    backgroundColor: FinanceTheme.colors.background,
    flex: 1,
  },
  subtitle: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.title,
    fontWeight: '900',
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
  },
});
