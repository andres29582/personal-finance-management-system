import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { resetPassword } from '../services/authService';
import { clearSession, getToken } from '../storage/authStorage';

export default function ResetPasswordScreen() {
  const [novaSenha, setNovaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function validateSession() {
      const token = await getToken();

      if (!token) {
        router.replace('/login');
      }
    }

    validateSession();

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  async function handleResetPassword() {
    setErro('');
    setSucesso('');

    if (!novaSenha) {
      setErro('Preencha a nova senha.');
      return;
    }

    try {
      setLoading(true);

      const resposta = await resetPassword({
        novaSenha,
      });

      setSucesso(resposta.message || 'Senha atualizada. Faça login novamente.');
      await clearSession();

      redirectTimeoutRef.current = setTimeout(() => {
        router.replace('/login');
      }, 1500);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        await clearSession();
        setErro('Sua sessão expirou. Faça login novamente.');
        router.replace('/login');
      } else {
        setErro('Não foi possível atualizar a senha.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backgroundLayer}>
        <Image
          source={require('../assets/images/img1_login.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Alterar senha</Text>
          <Text style={styles.subtitle}>
            Digite sua nova senha para continuar.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Nova senha"
            placeholderTextColor="#8A8A8A"
            secureTextEntry
            value={novaSenha}
            onChangeText={setNovaSenha}
            editable={!loading}
          />

          {erro ? <Text style={styles.errorText}>{erro}</Text> : null}
          {sucesso ? <Text style={styles.successText}>{sucesso}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Atualizando...' : 'Atualizar senha'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/dashboard' as never)}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>Voltar para home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EAF5E7',
    overflow: 'hidden',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#123524',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5D52',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D7E6D5',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#123524',
    backgroundColor: '#FAFAFA',
    marginBottom: 14,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  successText: {
    color: '#0B6B34',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#0B6B34',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#123524',
    fontSize: 15,
    fontWeight: '600',
  },
});
