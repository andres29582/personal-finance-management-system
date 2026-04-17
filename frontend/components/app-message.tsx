import { StyleSheet, Text } from 'react-native';
import { ContaTheme } from '../constants/contas-theme';

type AppMessageProps = {
  tone?: 'error' | 'muted' | 'success';
  value?: string;
};

export function AppMessage({
  tone = 'muted',
  value,
}: AppMessageProps) {
  if (!value) {
    return null;
  }

  return <Text style={[styles.base, toneStyles[tone]]}>{value}</Text>;
}

const styles = StyleSheet.create({
  base: {
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.sm,
    textAlign: 'center',
  },
});

const toneStyles = StyleSheet.create({
  error: {
    color: ContaTheme.colors.error,
  },
  muted: {
    color: ContaTheme.colors.muted,
  },
  success: {
    color: ContaTheme.colors.success,
  },
});
