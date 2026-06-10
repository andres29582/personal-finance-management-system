import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthScreen } from '../../../../components/auth-screen';
import { resolveApiError } from '../../../../utils/api-error';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { GlassButton, GlassField, GlassTextInput } from '../../../shared/ui';
import { forgotPassword } from '../services/authService';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devToken, setDevToken] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    setInfo('');
    setDevToken('');

    if (!email.trim()) {
      setError('Informe o e-mail da sua conta.');
      return;
    }

    try {
      setLoading(true);
      const res = await forgotPassword({ email: email.trim() });
      setInfo(res.message);
      if (res.resetToken) {
        setDevToken(res.resetToken);
      }
    } catch (err) {
      const resolved = await resolveApiError(err, 'Nao foi possivel enviar o pedido.');
      setError(resolved.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Recuperar senha"
      subtitle="Informe o e-mail cadastrado. Se existir conta, geramos um link interno de redefinicao."
      cardMaxWidth={400}
    >
      <GlassField label="E-mail" error={error && !info ? error : undefined}>
        <GlassTextInput
          placeholder="voce@exemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
      </GlassField>

      {info ? <Text style={styles.infoMessage}>{info}</Text> : null}
      {error && !info ? <Text style={styles.errorMessage}>{error}</Text> : null}
      {devToken ? (
        <View style={styles.devBox}>
          <Text style={styles.devTitle}>Token (ambiente de desenvolvimento)</Text>
          <Text selectable style={styles.devToken}>
            {devToken}
          </Text>
          <Text style={styles.devHint}>
            Copie e abra Redefinir senha; ou use /reset-password-token?token=...
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <GlassButton
          label={loading ? 'Enviando...' : 'Enviar instrucoes'}
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

export default ForgotPasswordScreen;

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
  devBox: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.sm,
    borderWidth: FinanceTheme.borderWidth.hairline,
    marginTop: FinanceTheme.spacing.sm,
    padding: FinanceTheme.spacing.sm,
  },
  devHint: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xs,
  },
  devTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  devToken: {
    color: FinanceTheme.colors.text,
    fontSize: 12,
    marginTop: FinanceTheme.spacing.xs,
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
