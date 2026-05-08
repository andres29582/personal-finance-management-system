import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppButton } from '../../../../components/app-button';
import { AppMessage } from '../../../../components/app-message';
import { AppField, appInputStyles } from '../../../../components/app-screen';
import { AuthScreen } from '../../../../components/auth-screen';
import { ContaTheme } from '../../../../constants/contas-theme';
import { forgotPassword } from '../services/authService';
import { resolveApiError } from '../../../../utils/api-error';

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
      <AppField label="E-mail" error={error && !info ? error : undefined}>
        <TextInput
          style={[appInputStyles.input, error && !info ? appInputStyles.inputError : null]}
          placeholder="voce@exemplo.com"
          placeholderTextColor="#8A8A8A"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
      </AppField>

      {info ? <AppMessage tone="muted" value={info} /> : null}
      {error && !info ? <AppMessage tone="error" value={error} /> : null}
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
        <AppButton
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
    marginTop: ContaTheme.spacing.md,
  },
  devBox: {
    backgroundColor: ContaTheme.colors.surface,
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.sm,
    borderWidth: 1,
    marginTop: ContaTheme.spacing.sm,
    padding: ContaTheme.spacing.sm,
  },
  devHint: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xs,
  },
  devTitle: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '700',
  },
  devToken: {
    color: ContaTheme.colors.text,
    fontSize: 12,
    marginTop: ContaTheme.spacing.xs,
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
