import { Pressable, StyleSheet, Text } from 'react-native';
import { FinanceAccent, FinanceTheme } from '../styles/financeTheme';

type GlassButtonProps = {
  accent?: FinanceAccent;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'danger' | 'ghost' | 'primary';
};

export function GlassButton({
  accent = 'cyan',
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: GlassButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        accentStyles[accent],
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
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: FinanceTheme.spacing.md,
  },
  disabled: {
    opacity: FinanceTheme.opacity.disabled,
  },
  pressed: {
    opacity: FinanceTheme.opacity.pressed,
  },
  text: {
    fontSize: FinanceTheme.typography.button,
    fontWeight: '800',
  },
});

const variantStyles = StyleSheet.create({
  danger: {
    backgroundColor: 'rgba(255, 122, 144, 0.10)',
    borderColor: 'rgba(255, 122, 144, 0.34)',
  },
  ghost: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
  },
  primary: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
});

const accentStyles = StyleSheet.create({
  cyan: {
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  magenta: {
    borderColor: FinanceTheme.neon.magenta.borderColor,
  },
  mixed: {
    borderColor: FinanceTheme.neon.mixed.borderColor,
  },
});

const textStyles = StyleSheet.create({
  danger: {
    color: FinanceTheme.colors.danger,
  },
  ghost: {
    color: FinanceTheme.colors.textMuted,
  },
  primary: {
    color: FinanceTheme.colors.text,
  },
});
