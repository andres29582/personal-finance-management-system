import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppMessage } from '../components/app-message';
import { AuthScreen } from '../components/auth-screen';
import { AppField, appInputStyles } from '../components/app-screen';
import { ContaTheme } from '../constants/contas-theme';
import { resetPasswordWithToken } from '../services/authService';
import { resolveApiError } from '../utils/api-error';

export default function ResetPasswordTokenScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof params.token === 'string' && params.token) {
      setToken(params.token);
    }
  }, [params.token]);

  async function handleSubmit() {
    setMessage('');
    setError('');

    if (!token.trim()) {
      setError('Cole o token de recuperacao.');
      return;
    }

    if (novaSenha.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmar) {
      setError('A confirmacao precisa ser igual a nova senha.');
      return;
    }

    try {
      setLoading(true);
      const res = await resetPasswordWithToken({
        token: token.trim(),
        novaSenha,
      });
      setMessage(res.message);
      setTimeout(() => {
        router.replace('/login' as never);
      }, 2000);
    } catch (err) {
      const resolved = await resolveApiError(err, 'Nao foi possivel redefinir a senha.', {
        400: 'Token invalido ou expirado. Solicite novamente em Esqueci minha senha.',
      });
      setError(resolved.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Nova senha"
      subtitle="Use o token recebido apos o pedido de recuperacao (ou o link com token)."
      cardMaxWidth={400}
    >
      <AppField label="Token">
        <TextInput
          style={appInputStyles.input}
          placeholder="Cole o token completo"
          placeholderTextColor="#8A8A8A"
          autoCapitalize="none"
          value={token}
          onChangeText={setToken}
          editable={!loading}
        />
      </AppField>

      <AppField label="Nova senha">
        <TextInput
          style={appInputStyles.input}
          placeholder="Minimo 6 caracteres"
          placeholderTextColor="#8A8A8A"
          secureTextEntry
          value={novaSenha}
          onChangeText={setNovaSenha}
          editable={!loading}
        />
      </AppField>

      <AppField label="Confirmar senha">
        <TextInput
          style={appInputStyles.input}
          placeholder="Repita a nova senha"
          placeholderTextColor="#8A8A8A"
          secureTextEntry
          value={confirmar}
          onChangeText={setConfirmar}
          editable={!loading}
        />
      </AppField>

      {message ? <AppMessage tone="muted" value={message} /> : null}
      {error ? <AppMessage tone="error" value={error} /> : null}

      <View style={styles.actions}>
        <AppButton
          label={loading ? 'Salvando...' : 'Redefinir senha'}
          onPress={handleSubmit}
          disabled={loading}
        />
      </View>

      <TouchableOpacity
        style={styles.back}
        onPress={() => router.replace('/login' as never)}
        disabled={loading}
      >
        <Text style={styles.backText}>Voltar ao login</Text>
      </TouchableOpacity>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: ContaTheme.spacing.md,
  },
  back: {
    alignItems: 'center',
    marginTop: ContaTheme.spacing.lg,
  },
  backText: {
    color: ContaTheme.colors.title,
    fontSize: 15,
    fontWeight: '600',
  },
});
