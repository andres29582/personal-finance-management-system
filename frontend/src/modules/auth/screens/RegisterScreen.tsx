import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthScreen } from '../../../../components/auth-screen';
import {
  formatCpfInput,
  isValidCep,
  isValidCpf,
} from '../../../../utils/br-input';
import { resolveApiError } from '../../../../utils/api-error';
import { useCepAutofill } from '../../../shared/hooks/use-cep-autofill';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { GlassField, GlassTextInput, LiquidButton } from '../../../shared/ui';
import { CepLookupResponse } from '../../../shared/types/cep';
import { register } from '../services/authService';
import { validatePassword } from '../validators/passwordPolicy';

type RegisterField =
  | 'cep'
  | 'cidade'
  | 'confirmarSenha'
  | 'cpf'
  | 'email'
  | 'endereco'
  | 'nome'
  | 'numero'
  | 'politica'
  | 'senha';

type RegisterErrors = Partial<Record<RegisterField, string>>;

export function RegisterScreen() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [cidade, setCidade] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [aceitoPoliticaPrivacidade, setAceitoPoliticaPrivacidade] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const applyCepLookup = useCallback((data: CepLookupResponse) => {
    setCep(formatCepValue(data.cep));
    if (data.endereco) {
      setEndereco(data.endereco);
    }
    if (data.cidade) {
      setCidade(data.cidade);
    }
    setErrors((current) => ({
      ...current,
      cep: undefined,
      endereco: data.endereco ? undefined : current.endereco,
      cidade: data.cidade ? undefined : current.cidade,
    }));
  }, []);

  const {
    cepLookupLoading,
    cepLookupMessage,
    cepLookupTone,
    handleCepValueChange,
  } = useCepAutofill({
    disabled: loading,
    onResolved: applyCepLookup,
  });
  const cepStatusMessage = cepLookupLoading
    ? 'Buscando CEP...'
    : cepLookupMessage || 'Digite os 8 digitos para preencher o endereco automaticamente.';
  const cepStatusTone = cepLookupLoading || !cepLookupMessage ? 'muted' : cepLookupTone;

  function validateForm(): RegisterErrors {
    const nextErrors: RegisterErrors = {};

    if (!nome.trim()) {
      nextErrors.nome = 'Informe seu nome completo.';
    }

    if (!email.trim()) {
      nextErrors.email = 'Informe seu e-mail.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Digite um e-mail valido.';
    }

    if (!isValidCpf(cpf)) {
      nextErrors.cpf = 'Digite um CPF com 11 digitos.';
    }

    if (!isValidCep(cep)) {
      nextErrors.cep = 'Digite um CEP valido.';
    }

    if (!endereco.trim()) {
      nextErrors.endereco = 'Informe sua rua, avenida ou logradouro.';
    }

    if (!numero.trim()) {
      nextErrors.numero = 'Informe o numero da residencia.';
    }

    if (!cidade.trim()) {
      nextErrors.cidade = 'Informe sua cidade.';
    }

    const passwordValidation = validatePassword(senha);
    if (!passwordValidation.valid) {
      nextErrors.senha = passwordValidation.message;
    }

    if (!confirmarSenha) {
      nextErrors.confirmarSenha = 'Confirme a senha.';
    } else if (confirmarSenha !== senha) {
      nextErrors.confirmarSenha = 'As senhas precisam ser iguais.';
    }

    if (!aceitoPoliticaPrivacidade) {
      nextErrors.politica = 'Aceite a politica de privacidade para continuar.';
    }

    return nextErrors;
  }

  async function handleRegister() {
    setMessage('');
    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessage('Revise os campos destacados para continuar.');
      return;
    }

    try {
      setLoading(true);
      await register({
        aceitoPoliticaPrivacidade: true,
        cep,
        cidade: cidade.trim(),
        cpf,
        endereco: endereco.trim(),
        nome: nome.trim(),
        email: email.trim(),
        numero: numero.trim(),
        senha,
      });
      router.replace('/login' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel confirmar a criacao da conta. Ela pode ter sido criada. Tente entrar ou recuperar sua senha pelo login.', {
        400: 'Confira CPF, CEP e os demais dados informados.',
        409: 'Ja existe um usuario com este e-mail ou CPF.',
      });

      const conflictField = getConflictField(resolvedError.code, resolvedError.message);
      if (conflictField) {
        setErrors((current) => ({
          ...current,
          [conflictField]:
            conflictField === 'email'
              ? 'Este e-mail ja esta cadastrado.'
              : 'Este CPF ja esta cadastrado.',
        }));
        setMessage('Corrija o campo destacado para continuar.');
        return;
      }

      setMessage(resolvedError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Cadastro"
      subtitle="Preencha seus dados para criar uma conta completa e segura."
      cardMaxWidth={420}
      titleOutsideCard
    >
      <GlassField label="Nome completo" error={errors.nome}>
        <GlassTextInput
          placeholder="Seu nome completo"
          value={nome}
          onChangeText={(value) => {
            setNome(value);
            setErrors((current) => ({ ...current, nome: undefined }));
          }}
          editable={!loading}
          autoCapitalize="words"
        />
      </GlassField>

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

      <GlassField label="CPF" error={errors.cpf}>
        <GlassTextInput
          placeholder="000.000.000-00"
          keyboardType="number-pad"
          maxLength={14}
          value={cpf}
          onChangeText={(value) => {
            setCpf(formatCpfInput(value));
            setErrors((current) => ({ ...current, cpf: undefined }));
          }}
          editable={!loading}
        />
      </GlassField>

      <GlassField label="CEP" error={errors.cep}>
        <GlassTextInput
          placeholder="00000-000"
          keyboardType="number-pad"
          maxLength={9}
          value={cep}
          onChangeText={(value) => {
            setCep(handleCepValueChange(value));
            setErrors((current) => ({ ...current, cep: undefined }));
          }}
          editable={!loading}
        />
      </GlassField>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.lookupMessage, lookupStyles[cepStatusTone]]}
        testID="cep-lookup-status"
      >
        {cepStatusMessage}
      </Text>

      <GlassField label="Endereco" error={errors.endereco}>
        <GlassTextInput
          placeholder="Rua, avenida ou logradouro"
          value={endereco}
          onChangeText={(value) => {
            setEndereco(value);
            setErrors((current) => ({ ...current, endereco: undefined }));
          }}
          editable={!loading}
          autoCapitalize="words"
        />
      </GlassField>

      <GlassField label="Numero" error={errors.numero}>
        <GlassTextInput
          placeholder="123 ou S/N"
          value={numero}
          onChangeText={(value) => {
            setNumero(value);
            setErrors((current) => ({ ...current, numero: undefined }));
          }}
          editable={!loading}
        />
      </GlassField>

      <GlassField label="Cidade" error={errors.cidade}>
        <GlassTextInput
          placeholder="Sua cidade"
          value={cidade}
          onChangeText={(value) => {
            setCidade(value);
            setErrors((current) => ({ ...current, cidade: undefined }));
          }}
          editable={!loading}
          autoCapitalize="words"
        />
      </GlassField>

      <GlassField label="Senha" error={errors.senha}>
        <GlassTextInput
          placeholder="Entre 6 e 64 caracteres"
          secureTextEntry={!showPassword}
          value={senha}
          onChangeText={(value) => {
            setSenha(value);
            setErrors((current) => ({ ...current, senha: undefined }));
          }}
          editable={!loading}
          rightAction={
            <PasswordVisibilityToggle
              visible={showPassword}
              onPress={() => setShowPassword((current) => !current)}
              testID="toggle-password-visibility"
            />
          }
        />
      </GlassField>

      <GlassField label="Confirmar senha" error={errors.confirmarSenha}>
        <GlassTextInput
          placeholder="Repita a senha"
          secureTextEntry={!showPasswordConfirmation}
          value={confirmarSenha}
          onChangeText={(value) => {
            setConfirmarSenha(value);
            setErrors((current) => ({
              ...current,
              confirmarSenha: undefined,
            }));
          }}
          editable={!loading}
          rightAction={
            <PasswordVisibilityToggle
              visible={showPasswordConfirmation}
              onPress={() => setShowPasswordConfirmation((current) => !current)}
              testID="toggle-confirm-password-visibility"
            />
          }
        />
      </GlassField>

      <GlassField label="Privacidade" error={errors.politica}>
        <TouchableOpacity
          style={styles.politicaRow}
          onPress={() => {
            setAceitoPoliticaPrivacidade((v) => !v);
            setErrors((current) => ({ ...current, politica: undefined }));
          }}
          disabled={loading}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: aceitoPoliticaPrivacidade }}
          aria-checked={aceitoPoliticaPrivacidade}
        >
          <View
            style={[
              styles.checkbox,
              aceitoPoliticaPrivacidade ? styles.checkboxOn : null,
              errors.politica ? styles.checkboxError : null,
            ]}
          >
            {aceitoPoliticaPrivacidade ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.politicaText}>
            Li e aceito a{' '}
            <Text
              style={styles.politicaLink}
              onPress={() => router.push('/privacidade' as never)}
            >
              Politica de Privacidade e LGPD (resumo)
            </Text>
            .
          </Text>
        </TouchableOpacity>
      </GlassField>

      {message ? <Text style={styles.errorMessage}>{message}</Text> : null}

      <View style={styles.actions}>
        <LiquidButton
          label={loading ? 'Criando...' : 'Criar conta'}
          onPress={handleRegister}
          disabled={loading}
        />
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace('/login' as never)}
        disabled={loading}
      >
        <Text style={styles.backButtonText}>Voltar para login</Text>
      </TouchableOpacity>
    </AuthScreen>
  );
}

export default RegisterScreen;

const styles = StyleSheet.create({
  actions: {
    marginTop: FinanceTheme.spacing.sm,
  },
  backButton: {
    alignItems: 'center',
    marginTop: FinanceTheme.spacing.md,
  },
  backButtonText: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  checkbox: {
    alignItems: 'center',
    borderColor: FinanceTheme.colors.border,
    borderRadius: 4,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    marginRight: FinanceTheme.spacing.sm,
    marginTop: 2,
    width: 22,
  },
  checkboxError: {
    borderColor: FinanceTheme.colors.danger,
  },
  checkboxMark: {
    color: FinanceTheme.colors.black,
    fontSize: 14,
    fontWeight: '900',
  },
  checkboxOn: {
    backgroundColor: FinanceTheme.colors.cyan,
    borderColor: FinanceTheme.colors.cyan,
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  lookupMessage: {
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    marginTop: -FinanceTheme.spacing.xs,
  },
  politicaLink: {
    color: FinanceTheme.colors.cyanMuted,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  politicaRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  politicaText: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 20,
  },
  toggleVisibilityButton: {
    padding: 6,
  },
});

function PasswordVisibilityToggle({
  onPress,
  testID,
  visible,
}: {
  onPress: () => void;
  testID: string;
  visible: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityHint={visible ? 'Oculta a senha' : 'Mostra a senha'}
      accessibilityLabel="Alternar visibilidade da senha"
      accessibilityRole="button"
      hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
      onPress={onPress}
      style={styles.toggleVisibilityButton}
      testID={testID}
    >
      <MaterialCommunityIcons
        color={visible ? FinanceTheme.colors.aquateal[400] : FinanceTheme.colors.textSubtle}
        name={visible ? 'eye-outline' : 'eye-off-outline'}
        size={18}
      />
    </TouchableOpacity>
  );
}

const lookupStyles = StyleSheet.create({
  error: {
    color: FinanceTheme.colors.danger,
  },
  muted: {
    color: FinanceTheme.colors.textMuted,
  },
  success: {
    color: FinanceTheme.colors.success,
  },
});

function formatCepValue(cep: string) {
  return cep.length === 9 ? cep : `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function getConflictField(
  code: string | undefined,
  message: string,
): Extract<RegisterField, 'cpf' | 'email'> | undefined {
  const codeSource = (code ?? '').toLowerCase();

  if (codeSource.includes('email')) {
    return 'email';
  }

  if (codeSource.includes('cpf')) {
    return 'cpf';
  }

  const messageSource = message.toLowerCase();
  const mentionsEmail = messageSource.includes('email') || messageSource.includes('e-mail');
  const mentionsCpf = messageSource.includes('cpf');

  if (mentionsEmail !== mentionsCpf) {
    return mentionsEmail ? 'email' : 'cpf';
  }

  return undefined;
}
