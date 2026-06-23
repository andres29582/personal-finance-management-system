import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthScreen } from '../../../../components/auth-screen';
import { saveRefreshToken, saveToken, saveUser } from '../../../../storage/authStorage';
import { resolveApiError } from '../../../../utils/api-error';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { GlassButton, GlassField, GlassTextInput } from '../../../shared/ui';
import { login } from '../services/authService';

type LoginField = 'email' | 'senha';
type LoginErrors = Partial<Record<LoginField, string>>;

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function validateForm(): LoginErrors {
    const nextErrors: LoginErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Informe seu e-mail.';
    }

    if (!senha.trim()) {
      nextErrors.senha = 'Informe sua senha.';
    }

    return nextErrors;
  }

  async function handleLogin() {
    setMessage('');
    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessage('Preencha e-mail e senha para continuar.');
      return;
    }

    try {
      setLoading(true);

      const resposta = await login({
        email: email.trim(),
        senha,
      });

      if (!resposta.access_token || !resposta.refresh_token || !resposta.usuario) {
        throw new Error('Resposta de login invalida.');
      }

      await saveToken(resposta.access_token);
      await saveRefreshToken(resposta.refresh_token);
      await saveUser(resposta.usuario);
      router.replace('/dashboard' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel entrar agora.',
        {
          401: 'E-mail ou senha invalidos.',
        },
      );
      setMessage(resolvedError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Login"
      subtitle="Entre para acompanhar seu resumo financeiro e continuar de onde parou."
      cardMaxWidth={360}
    >
      <GlassField label="E-mail" error={errors.email}>
        <GlassTextInput
          placeholder="voce@exemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          editable={!loading}
        />
      </GlassField>

      <GlassField label="Senha" error={errors.senha}>
        <GlassTextInput
          placeholder="Sua senha"
          secureTextEntry
          value={senha}
          onChangeText={(value) => {
            setSenha(value);
            setErrors((current) => ({ ...current, senha: undefined }));
          }}
          editable={!loading}
        />
      </GlassField>

      <Text style={styles.hint}>Logado, voce pode alterar a senha em Configuracoes &gt; Senha.</Text>
      {message ? <Text style={styles.errorMessage}>{message}</Text> : null}

      <View style={styles.actions}>
        <GlassButton
          label={loading ? 'Entrando...' : 'Entrar'}
          onPress={handleLogin}
          disabled={loading}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Novo por aqui?</Text>
        <TouchableOpacity onPress={() => router.push('/register' as never)} disabled={loading}>
          <Text style={styles.footerLink}>Cadastrar</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.secureText}>Acesso seguro</Text>
    </AuthScreen>
  );
}

export default LoginScreen;

const styles = StyleSheet.create({
  actions: {
    marginTop: FinanceTheme.spacing.sm,
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: FinanceTheme.spacing.md,
  },
  footerLink: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: 15,
    fontWeight: '800',
    marginLeft: FinanceTheme.spacing.xs,
  },
  footerText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: 15,
  },
  hint: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.sm,
  },
  secureText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: 14,
    marginTop: FinanceTheme.spacing.md,
    textAlign: 'center',
  },
});
