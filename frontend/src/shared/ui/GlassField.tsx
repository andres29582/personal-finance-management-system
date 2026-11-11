import { ReactNode, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
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

export type GlassTextInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: ReactNode;
  rightAction?: ReactNode;
};

export function GlassTextInput({
  containerStyle,
  leftIcon,
  rightAction,
  onBlur,
  onFocus,
  style,
  ...props
}: GlassTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  if (!leftIcon && !rightAction) {
    return (
      <TextInput
        placeholderTextColor={FinanceTheme.colors.textSubtle}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...props}
        style={[styles.input, isFocused ? styles.inputFocused : null, style]}
      />
    );
  }

  return (
    <View
      style={[
        styles.inputWrapper,
        isFocused ? styles.inputFocused : null,
        containerStyle,
      ]}
    >
      {leftIcon ? <View style={styles.leftIconContainer}>{leftIcon}</View> : null}
      <TextInput
        placeholderTextColor={FinanceTheme.colors.textSubtle}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...props}
        style={[styles.embeddedInput, style]}
      />
      {rightAction ? (
        <View style={styles.rightActionContainer}>{rightAction}</View>
      ) : null}
    </View>
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
  inputFocused: {
    borderColor: FinanceTheme.colors.aquateal[500],
  },
  inputWrapper: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.abyss[950],
    borderColor: FinanceTheme.colors.phthaloBorderInput,
    borderRadius: FinanceTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
  },
  embeddedInput: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.body,
    minHeight: 48,
    paddingHorizontal: FinanceTheme.spacing.xs,
    paddingVertical: 10,
  },
  leftIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: FinanceTheme.spacing.md,
    paddingRight: FinanceTheme.spacing.xs,
  },
  rightActionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: FinanceTheme.spacing.sm,
  },
  label: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.xs,
  },
});
