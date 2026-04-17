import { Pressable, StyleSheet, Text } from 'react-native';
import { ContaTheme } from '../constants/contas-theme';

type AppButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'danger' | 'ghost' | 'primary' | 'secondary';
};

export function AppButton({
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: AppButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.text, textStyles[variant]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: ContaTheme.radius.md,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: ContaTheme.spacing.md,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontSize: ContaTheme.typography.button,
    fontWeight: '700',
  },
});

const variantStyles = StyleSheet.create({
  danger: {
    backgroundColor: '#FCE9E8',
    borderColor: '#F3C0BE',
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: ContaTheme.colors.surface,
    borderColor: ContaTheme.colors.border,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: ContaTheme.colors.primary,
  },
  secondary: {
    backgroundColor: ContaTheme.colors.title,
  },
});

const textStyles = StyleSheet.create({
  danger: {
    color: ContaTheme.colors.error,
  },
  ghost: {
    color: ContaTheme.colors.muted,
  },
  primary: {
    color: ContaTheme.colors.white,
  },
  secondary: {
    color: ContaTheme.colors.white,
  },
});
