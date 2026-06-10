import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthScreen } from '../../../../components/auth-screen';
import {
  formatCpfInput,
  isValidCep,
  isValidCpf,
} from '../../../../utils/br-input';
import { resolveApiError } from '../../../../utils/api-error';
import { useCepAutofill } from '../../../shared/hooks/use-cep-autofill';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { GlassButton, GlassField, GlassTextInput } from '../../../shared/ui';
import { CepLookupResponse } from '../../../shared/types/cep';
import { register } from '../services/authService';

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

    if (!senha.trim()) {
      nextErrors.senha = 'Informe uma senha.';
    } else if (senha.trim().length < 6) {
      nextErrors.senha = 'A senha deve ter pelo menos 6 caracteres.';
    }

    if (!confirmarSenha.trim()) {
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
      const resolvedError = await resolveApiError(error, 'Nao foi possivel criar a conta.', {
        400: 'Confira CPF, CEP e os demais dados informados.',
        409: 'Ja existe um usuario com este e-mail ou CPF.',
      });
      setMessage(resolvedError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Cadastro"
      subtitle="Preencha seus dados para criar uma conta completa e segura."
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

      <View style={styles.inlineFields}>
        <View style={styles.inlineField}>
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
        </View>

        <View style={styles.inlineField}>
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
          {cepLookupLoading || cepLookupMessage ? (
            <Text style={[styles.lookupMessage, lookupStyles[cepLookupTone]]}>
              {cepLookupMessage}
            </Text>
          ) : null}
        </View>
      </View>

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

      <View style={styles.inlineFields}>
        <View style={styles.inlineField}>
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
        </View>

        <View style={styles.inlineField}>
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
        </View>
      </View>

      <GlassField label="Senha" error={errors.senha}>
        <GlassTextInput
          placeholder="Crie uma senha"
          secureTextEntry
          value={senha}
          onChangeText={(value) => {
            setSenha(value);
            setErrors((current) => ({ ...current, senha: undefined }));
          }}
          editable={!loading}
        />
      </GlassField>

      <GlassField label="Confirmar senha" error={errors.confirmarSenha}>
        <GlassTextInput
          placeholder="Repita a senha"
          secureTextEntry
          value={confirmarSenha}
          onChangeText={(value) => {
            setConfirmarSenha(value);
            setErrors((current) => ({
              ...current,
              confirmarSenha: undefined,
            }));
          }}
          editable={!loading}
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
        <GlassButton
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
  inlineField: {
    width: '48%',
  },
  inlineFields: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});

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
