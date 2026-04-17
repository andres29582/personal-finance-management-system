import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ContaTheme } from '../constants/contas-theme';

export type AppOption = {
  label: string;
  value: string;
};

type AppOptionGroupProps = {
  options: AppOption[];
  onChange: (value: string) => void;
  selectedValue?: string;
};

export function AppOptionGroup({
  options,
  onChange,
  selectedValue,
}: AppOptionGroupProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const selected = option.value === selectedValue;

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected ? styles.optionSelected : null]}
          >
            <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ContaTheme.spacing.xs,
  },
  option: {
    backgroundColor: '#EDF5ED',
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.md,
    borderWidth: 1,
    paddingHorizontal: ContaTheme.spacing.sm,
    paddingVertical: ContaTheme.spacing.xs,
  },
  optionSelected: {
    backgroundColor: ContaTheme.colors.primary,
    borderColor: ContaTheme.colors.primary,
  },
  optionText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: ContaTheme.colors.white,
  },
});
