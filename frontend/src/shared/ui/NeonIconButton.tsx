import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { FinanceAccent, FinanceTheme } from '../styles/financeTheme';

type NeonIconButtonProps = {
  accent?: FinanceAccent;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label?: string;
  onPress: () => void;
};

export function NeonIconButton({
  accent = 'mixed',
  icon,
  label,
  onPress,
}: NeonIconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        accentStyles[accent],
        pressed ? styles.pressed : null,
      ]}
    >
      <MaterialCommunityIcons
        color={
          accent === 'magenta'
            ? FinanceTheme.colors.magenta
            : FinanceTheme.colors.cyan
        }
        name={icon}
        size={18}
      />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    gap: FinanceTheme.spacing.xs,
    minHeight: 40,
    paddingHorizontal: FinanceTheme.spacing.sm,
  },
  label: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  pressed: {
    opacity: FinanceTheme.opacity.pressed,
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
