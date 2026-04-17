import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ContaTheme } from '../constants/contas-theme';
import { logoutSession } from '../services/authService';
import { clearSession, getUser } from '../storage/authStorage';
import { UsuarioLogado } from '../types/auth';

export default function HomeScreen() {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);

  useEffect(() => {
    async function loadUser() {
      const user = await getUser();
      setUsuario(user);
    }

    loadUser();
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
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>

      <Text style={styles.text}>
        Bem-vindo{usuario?.nome ? `, ${usuario.nome}` : ''}.
      </Text>

      <Text style={styles.text}>
        {usuario?.email ? `Email: ${usuario.email}` : 'Usuário não carregado.'}
      </Text>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push('/contas')}
      >
        <Text style={styles.secondaryButtonText}>Minhas contas</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push('/reset-password')}
      >
        <Text style={styles.secondaryButtonText}>Alterar senha</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: ContaTheme.spacing.lg,
    backgroundColor: ContaTheme.colors.screenBg,
  },
  title: {
    fontSize: ContaTheme.typography.title,
    fontWeight: 'bold',
    color: ContaTheme.colors.title,
    marginBottom: ContaTheme.spacing.lg,
    textAlign: 'center',
  },
  text: {
    color: ContaTheme.colors.text,
    fontSize: ContaTheme.typography.body,
    marginBottom: ContaTheme.spacing.sm,
    textAlign: 'center',
  },
  secondaryButton: {
    height: 50,
    backgroundColor: ContaTheme.colors.title,
    borderRadius: ContaTheme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: ContaTheme.spacing.lg,
  },
  secondaryButtonText: {
    color: ContaTheme.colors.white,
    fontSize: ContaTheme.typography.button,
    fontWeight: 'bold',
  },
  button: {
    height: 50,
    backgroundColor: ContaTheme.colors.error,
    borderRadius: ContaTheme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: ContaTheme.spacing.sm,
  },
  buttonText: {
    color: ContaTheme.colors.white,
    fontSize: ContaTheme.typography.button,
    fontWeight: 'bold',
  },
});
