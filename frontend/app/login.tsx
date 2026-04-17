import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppMessage } from '../components/app-message';
import { AuthScreen } from '../components/auth-screen';
import { AppField, appInputStyles } from '../components/app-screen';
import { ContaTheme } from '../constants/contas-theme';
import { login } from '../services/authService';
import { saveRefreshToken, saveToken, saveUser } from '../storage/authStorage';
import { resolveApiError } from '../utils/api-error';

type LoginField = 'email' | 'senha';
type LoginErrors = Partial<Record<LoginField, string>>;

export default function LoginScreen() {
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
      <AppField label="E-mail" error={errors.email}>
        <TextInput
          style={[appInputStyles.input, errors.email ? appInputStyles.inputError : null]}
          placeholder="voce@exemplo.com"
          placeholderTextColor="#8A8A8A"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          editable={!loading}
        />
      </AppField>

      <AppField label="Senha" error={errors.senha}>
        <TextInput
          style={[appInputStyles.input, errors.senha ? appInputStyles.inputError : null]}
          placeholder="Sua senha"
          placeholderTextColor="#8A8A8A"
          secureTextEntry
          value={senha}
          onChangeText={(value) => {
            setSenha(value);
            setErrors((current) => ({ ...current, senha: undefined }));
          }}
          editable={!loading}
        />
      </AppField>

      <AppMessage
        tone="muted"
        value="A troca de senha fica disponivel depois do login."
      />
      <AppMessage tone="error" value={message} />

      <View style={styles.actions}>
        <AppButton
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

const styles = StyleSheet.create({
  actions: {
    marginTop: ContaTheme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: ContaTheme.spacing.md,
  },
  footerLink: {
    color: '#123524',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: ContaTheme.spacing.xs,
  },
  footerText: {
    color: '#2F4136',
    fontSize: 15,
  },
  secureText: {
    color: '#2F4136',
    fontSize: 14,
    marginTop: ContaTheme.spacing.md,
    textAlign: 'center',
  },
});
