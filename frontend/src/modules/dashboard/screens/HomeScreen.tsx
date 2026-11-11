import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { getSessionGeneration, getUser, subscribeAuthState } from '../../../../storage/authStorage';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { AppShell, FinanceAppHeader, GlassButton, GlassPanel, } from '../../../shared/ui';
import { logout } from '../../auth/services/logoutCoordinator';
import { UsuarioLogado } from '../../auth/types/auth';
export function HomeScreen() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  useEffect(() => {
    let active = true;
    const generation = getSessionGeneration();
    const unsubscribe = subscribeAuthState(() => { if (generation !== getSessionGeneration())
      setUsuario(null); });
    async function loadUser() {
      const user = await getUser();
      if (active && generation === getSessionGeneration())
        setUsuario(user);
    }
    void loadUser();
    return () => { active = false; unsubscribe(); };
  }, []);
  async function handleLogout() {
    const operation = logout();
    setUsuario(null);
    router.replace('/login');
    await operation.completion;
  }
  return (<AppShell activeRoute="/home" onLogout={handleLogout} onProfilePress={() => router.push('/usuario')} pageHeader={<FinanceAppHeader eyebrow="Inicio" subtitle={usuario?.email ? `Email: ${usuario.email}` : 'Usuario nao carregado.'} title={`Bem-vindo${usuario?.nome ? `, ${usuario.nome}` : ''}`}/>} profileDetail={usuario?.email} profileLabel={usuario?.nome ?? 'Perfil'}>
   <GlassPanel>
    <Text style={styles.title}>Atalhos</Text>
    <Text style={styles.text}>
     Acesse rapidamente suas contas, altere a senha ou encerre a sessao.
    </Text>
    <GlassButton label="Minhas contas" onPress={() => router.push('/contas')}/>
    <GlassButton label="Alterar senha" onPress={() => router.push('/reset-password')} variant="ghost"/>
    <GlassButton label="Sair" onPress={handleLogout} variant="danger"/>
   </GlassPanel>
  </AppShell>);
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
