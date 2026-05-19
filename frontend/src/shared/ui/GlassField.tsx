import { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { FinanceTheme } from '../styles/financeTheme';

type GlassFieldProps = {
  children: ReactNode;
  error?: string;
  label: string;
};

export function GlassField({ children, error, label }: GlassFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function GlassTextInput(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={FinanceTheme.colors.textSubtle}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  error: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.xs,
  },
  field: {
    marginBottom: FinanceTheme.spacing.sm,
  },
  input: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    minHeight: 48,
    paddingHorizontal: FinanceTheme.spacing.sm,
  },
  label: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.xs,
  },
});
