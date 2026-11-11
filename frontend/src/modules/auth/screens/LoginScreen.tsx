import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthScreen } from '../../../../components/auth-screen';
import { reconcileSession, installSession } from '../../../../storage/authStorage';
import { resolveApiError } from '../../../../utils/api-error';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { GlassField, GlassTextInput, LiquidButton, OceanicLogoLoader } from '../../../shared/ui';
import { login } from '../services/authService';

type LoginField = 'email' | 'senha';
type LoginErrors = Partial<Record<LoginField, string>>;

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    void reconcileSession().then(origin => {
      if (active && origin?.status === 'refreshOutcomeUnknown')
        setMessage('Não foi possível confirmar a renovação da sessão. Faça login novamente.');
    }).catch(error => { void resolveApiError(error, 'Não foi possível verificar a sessão.').then(resolved => { if (active) setMessage(resolved.message); }); });
    return () => { active = false; };
  }, []);

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
      const origin = await reconcileSession();

      const resposta = await login({
        email: email.trim(),
        senha,
      });

      if (!resposta.access_token || !resposta.refresh_token || !resposta.usuario) {
        throw new Error('Resposta de login invalida.');
      }

      if (!(await installSession(resposta, origin))) return;
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
      cardMaxWidth={420}
      focalElement={
        <OceanicLogoLoader
          accessibilityLabel="Marca AEPV.ia.finance"
          size={72}
        />
      }
      titleOutsideCard
    >
      {/* Campo 1: E-mail */}
      <GlassField label="E-mail" error={errors.email}>
        <GlassTextInput
          accessibilityLabel="E-mail"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          editable={!loading}
          leftIcon={
            <MaterialCommunityIcons
              name="email-outline"
              size={18}
              color={FinanceTheme.colors.textSubtle}
            />
          }
        />
      </GlassField>

      {/* Campo 2: Senha */}
      <View style={styles.passwordHeaderRow}>
        <Text style={styles.passwordLabel}>Senha</Text>
        <TouchableOpacity
          accessibilityLabel="Recuperar senha"
          accessibilityRole="button"
          onPress={() => router.push('/forgot-password' as never)}
          disabled={loading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.forgotPasswordLink}>Esqueceu a senha?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.passwordFieldWrapper}>
        <GlassTextInput
          accessibilityLabel="Senha"
          autoComplete="current-password"
          placeholder="Sua senha"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          value={senha}
          onChangeText={(value) => {
            setSenha(value);
            setErrors((current) => ({ ...current, senha: undefined }));
          }}
          editable={!loading}
          leftIcon={
            <MaterialCommunityIcons
              name="lock-outline"
              size={18}
              color={FinanceTheme.colors.textSubtle}
            />
          }
          rightAction={
            <TouchableOpacity
              accessibilityHint={
                showPassword ? 'Oculta a senha' : 'Mostra a senha'
              }
              accessibilityLabel="Alternar visibilidade da senha"
              accessibilityRole="button"
              onPress={() => setShowPassword((prev) => !prev)}
              style={styles.toggleVisibilityBtn}
              testID="toggle-password-visibility"
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={showPassword ? FinanceTheme.colors.aquateal[400] : FinanceTheme.colors.textSubtle}
              />
            </TouchableOpacity>
          }
        />
        {errors.senha ? <Text style={styles.fieldError}>{errors.senha}</Text> : null}
      </View>

      {/* Micro-copy de orientacao */}
      <View style={styles.hintContainer}>
        <MaterialCommunityIcons
          name="information-outline"
          size={14}
          color={FinanceTheme.colors.phthalo[400]}
          style={styles.hintIcon}
        />
        <Text style={styles.hint}>
          Logado, voce pode alterar a senha em Configuracoes &gt; Senha.
        </Text>
      </View>

      {/* Mensagem de Erro Global */}
      {message ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={16}
            color={FinanceTheme.colors.danger}
          />
          <Text style={styles.errorMessage}>{message}</Text>
        </View>
      ) : null}

      {/* Botao de Acao Principal (Entrar ->) */}
      <View style={styles.actions}>
        <LiquidButton label="Entrar" loading={loading} onPress={handleLogin} />
      </View>

      {/* Footer com link de cadastro */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Novo por aqui?</Text>
        <TouchableOpacity
          accessibilityLabel="Criar conta"
          accessibilityRole="button"
          onPress={() => router.push('/register' as never)}
          disabled={loading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.footerLink}>Cadastrar</Text>
        </TouchableOpacity>
      </View>

      <View accessibilityLabel="Conexao protegida" style={styles.secureRow}>
        <View style={styles.secureDot} />
        <Text style={styles.secureText}>Conexao protegida</Text>
      </View>
    </AuthScreen>
  );
}

export default LoginScreen;

const styles = StyleSheet.create({
  actions: {
    marginTop: FinanceTheme.spacing.sm,
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 122, 144, 0.12)',
    borderColor: 'rgba(255, 122, 144, 0.35)',
    borderRadius: FinanceTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: FinanceTheme.spacing.sm,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xs,
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  fieldError: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.xxs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: FinanceTheme.spacing.md,
  },
  footerLink: {
    color: FinanceTheme.colors.aquateal[400],
    fontSize: 14,
    fontWeight: '800',
    marginLeft: FinanceTheme.spacing.xs,
  },
  footerText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: 14,
  },
  forgotPasswordLink: {
    color: FinanceTheme.colors.aquateal[400],
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    color: FinanceTheme.colors.textMuted,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 18,
  },
  hintContainer: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    marginTop: FinanceTheme.spacing.xs,
  },
  hintIcon: {
    marginTop: 2,
  },
  passwordFieldWrapper: {
    marginBottom: FinanceTheme.spacing.sm,
  },
  passwordHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.xs,
  },
  passwordLabel: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  secureDot: {
    backgroundColor: FinanceTheme.colors.aquateal[500],
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  secureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: FinanceTheme.spacing.sm,
  },
  secureText: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: 12,
    textAlign: 'center',
  },
  toggleVisibilityBtn: {
    padding: 6,
  },
});
