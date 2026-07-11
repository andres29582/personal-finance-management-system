import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthScreen } from '../../../../components/auth-screen';
import { resolveApiError } from '../../../../utils/api-error';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { GlassButton, GlassField, GlassTextInput } from '../../../shared/ui';
import { resetPasswordWithToken } from '../services/authService';
import { validatePassword } from '../validators/passwordPolicy';

export function ResetPasswordTokenScreen() {
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

    const passwordValidation = validatePassword(novaSenha);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
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
      <GlassField label="Token">
        <GlassTextInput
          placeholder="Cole o token completo"
          autoCapitalize="none"
          value={token}
          onChangeText={setToken}
          editable={!loading}
        />
      </GlassField>

      <GlassField label="Nova senha">
        <GlassTextInput
          placeholder="Entre 6 e 64 caracteres"
          secureTextEntry
          value={novaSenha}
          onChangeText={setNovaSenha}
          editable={!loading}
        />
      </GlassField>

      <GlassField label="Confirmar senha">
        <GlassTextInput
          placeholder="Repita a nova senha"
          secureTextEntry
          value={confirmar}
          onChangeText={setConfirmar}
          editable={!loading}
        />
      </GlassField>

      {message ? <Text style={styles.infoMessage}>{message}</Text> : null}
      {error ? <Text style={styles.errorMessage}>{error}</Text> : null}

      <View style={styles.actions}>
        <GlassButton
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

export default ResetPasswordTokenScreen;

const styles = StyleSheet.create({
  actions: {
    marginTop: FinanceTheme.spacing.md,
  },
  back: {
    alignItems: 'center',
    marginTop: FinanceTheme.spacing.lg,
  },
  backText: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  infoMessage: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
});
