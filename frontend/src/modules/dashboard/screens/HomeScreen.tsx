import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { clearSession, getUser } from '../../../../storage/authStorage';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassPanel,
} from '../../../shared/ui';
import { logoutSession } from '../../auth/services/authService';
import { UsuarioLogado } from '../../auth/types/auth';
import { dashboardSidebarItems } from '../utils/dashboardMappers';

export function HomeScreen() {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);

  useEffect(() => {
    async function loadUser() {
      const user = await getUser();
      setUsuario(user);
    }

    void loadUser();
  }, []);

  async function handleLogout() {
    try {
      await logoutSession();
    } finally {
      await clearSession();
      router.replace('/login');
    }
  }

  return (
    <FinanceAppShell
      activeRoute="/home"
      header={
        <FinanceAppHeader
          eyebrow="Inicio"
          subtitle={usuario?.email ? `Email: ${usuario.email}` : 'Usuario nao carregado.'}
          title={`Bem-vindo${usuario?.nome ? `, ${usuario.nome}` : ''}`}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={dashboardSidebarItems}
    >
      <GlassPanel>
        <Text style={styles.title}>Atalhos</Text>
        <Text style={styles.text}>
          Acesse rapidamente suas contas, altere a senha ou encerre a sessao.
        </Text>
        <GlassButton label="Minhas contas" onPress={() => router.push('/contas')} />
        <GlassButton
          label="Alterar senha"
          onPress={() => router.push('/reset-password')}
          variant="ghost"
        />
        <GlassButton label="Sair" onPress={handleLogout} variant="danger" />
      </GlassPanel>
    </FinanceAppShell>
  );
}

const styles = StyleSheet.create({
  text: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.body,
    marginBottom: FinanceTheme.spacing.md,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.heading,
    fontWeight: '900',
    marginBottom: FinanceTheme.spacing.xs,
  },
});

export default HomeScreen;
