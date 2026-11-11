import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../src/shared/styles/financeTheme';
import { AppShell, FinanceAppHeader, GlassPanel } from '../src/shared/ui';

export default function DecisoesScreen() {
  const router = useRouter();

  return (
    <AppShell
      activeRoute="/decisoes"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          eyebrow="Planejamento assistido"
          subtitle="Um espaço reservado para decisões financeiras futuras."
          title="Decisões"
        />
      }
    >
      <GlassPanel>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>Somente leitura</Text>
          <Text style={styles.description}>
            Esta área é somente informativa. Nenhuma decisão é criada, salva ou
            executada por esta tela.
          </Text>
        </View>
      </GlassPanel>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingVertical: FinanceTheme.spacing.xl },
  description: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.body,
    lineHeight: 24,
    maxWidth: 560,
    textAlign: 'center',
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.heading,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
});
