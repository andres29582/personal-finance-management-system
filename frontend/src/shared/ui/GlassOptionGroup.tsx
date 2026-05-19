import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../styles/financeTheme';

type GlassOption<T extends string> = {
  label: string;
  value: T;
};

type GlassOptionGroupProps<T extends string> = {
  onChange: (value: T) => void;
  options: GlassOption<T>[];
  value: T;
};

export function GlassOptionGroup<T extends string>({
  onChange,
  options,
  value,
}: GlassOptionGroupProps<T>) {
  return (
    <View style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected ? styles.selected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.label, selected ? styles.selectedLabel : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
  },
  label: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  option: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xs,
  },
  pressed: {
    opacity: FinanceTheme.opacity.pressed,
  },
  selected: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  selectedLabel: {
    color: FinanceTheme.colors.text,
  },
});
