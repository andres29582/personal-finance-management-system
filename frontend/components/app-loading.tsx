import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ContaTheme } from '../constants/contas-theme';

type AppLoadingProps = {
  label?: string;
};

export function AppLoading({ label = 'Carregando...' }: AppLoadingProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={ContaTheme.colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: ContaTheme.spacing.lg,
  },
  label: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.body,
    marginTop: ContaTheme.spacing.sm,
    textAlign: 'center',
  },
});
