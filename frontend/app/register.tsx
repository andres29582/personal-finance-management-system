import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppMessage } from '../components/app-message';
import { AuthScreen } from '../components/auth-screen';
import { AppField, appInputStyles } from '../components/app-screen';
import { ContaTheme } from '../constants/contas-theme';
import { useCepAutofill } from '../hooks/use-cep-autofill';
import { register } from '../services/authService';
import { CepLookupResponse } from '../types/cep';
import { resolveApiError } from '../utils/api-error';
import {
  formatCpfInput,
  isValidCep,
  isValidCpf,
} from '../utils/br-input';

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

export default function RegisterScreen() {
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
      <AppField label="Nome completo" error={errors.nome}>
        <TextInput
          style={[appInputStyles.input, errors.nome ? appInputStyles.inputError : null]}
          placeholder="Seu nome completo"
          placeholderTextColor="#8A8A8A"
          value={nome}
          onChangeText={(value) => {
            setNome(value);
            setErrors((current) => ({ ...current, nome: undefined }));
          }}
          editable={!loading}
          autoCapitalize="words"
        />
      </AppField>

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

      <View style={styles.inlineFields}>
        <View style={styles.inlineField}>
          <AppField label="CPF" error={errors.cpf}>
            <TextInput
              style={[appInputStyles.input, errors.cpf ? appInputStyles.inputError : null]}
              placeholder="000.000.000-00"
              placeholderTextColor="#8A8A8A"
              keyboardType="number-pad"
              maxLength={14}
              value={cpf}
              onChangeText={(value) => {
                setCpf(formatCpfInput(value));
                setErrors((current) => ({ ...current, cpf: undefined }));
              }}
              editable={!loading}
            />
          </AppField>
        </View>

        <View style={styles.inlineField}>
          <AppField label="CEP" error={errors.cep}>
            <TextInput
              style={[appInputStyles.input, errors.cep ? appInputStyles.inputError : null]}
              placeholder="00000-000"
              placeholderTextColor="#8A8A8A"
              keyboardType="number-pad"
              maxLength={9}
              value={cep}
              onChangeText={(value) => {
                setCep(handleCepValueChange(value));
                setErrors((current) => ({ ...current, cep: undefined }));
              }}
              editable={!loading}
            />
          </AppField>
          <AppMessage
            tone={cepLookupTone}
            value={cepLookupLoading || cepLookupMessage ? cepLookupMessage : undefined}
          />
        </View>
      </View>

      <AppField label="Endereco" error={errors.endereco}>
        <TextInput
          style={[appInputStyles.input, errors.endereco ? appInputStyles.inputError : null]}
          placeholder="Rua, avenida ou logradouro"
          placeholderTextColor="#8A8A8A"
          value={endereco}
          onChangeText={(value) => {
            setEndereco(value);
            setErrors((current) => ({ ...current, endereco: undefined }));
          }}
          editable={!loading}
          autoCapitalize="words"
        />
      </AppField>

      <View style={styles.inlineFields}>
        <View style={styles.inlineField}>
          <AppField label="Numero" error={errors.numero}>
            <TextInput
              style={[appInputStyles.input, errors.numero ? appInputStyles.inputError : null]}
              placeholder="123 ou S/N"
              placeholderTextColor="#8A8A8A"
              value={numero}
              onChangeText={(value) => {
                setNumero(value);
                setErrors((current) => ({ ...current, numero: undefined }));
              }}
              editable={!loading}
            />
          </AppField>
        </View>

        <View style={styles.inlineField}>
          <AppField label="Cidade" error={errors.cidade}>
            <TextInput
              style={[appInputStyles.input, errors.cidade ? appInputStyles.inputError : null]}
              placeholder="Sua cidade"
              placeholderTextColor="#8A8A8A"
              value={cidade}
              onChangeText={(value) => {
                setCidade(value);
                setErrors((current) => ({ ...current, cidade: undefined }));
              }}
              editable={!loading}
              autoCapitalize="words"
            />
          </AppField>
        </View>
      </View>

      <AppField label="Senha" error={errors.senha}>
        <TextInput
          style={[appInputStyles.input, errors.senha ? appInputStyles.inputError : null]}
          placeholder="Crie uma senha"
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

      <AppField label="Confirmar senha" error={errors.confirmarSenha}>
        <TextInput
          style={[
            appInputStyles.input,
            errors.confirmarSenha ? appInputStyles.inputError : null,
          ]}
          placeholder="Repita a senha"
          placeholderTextColor="#8A8A8A"
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
      </AppField>

      <AppField label="Privacidade" error={errors.politica}>
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
      </AppField>

      <AppMessage tone="error" value={message} />

      <View style={styles.actions}>
        <AppButton
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

const styles = StyleSheet.create({
  actions: {
    marginTop: ContaTheme.spacing.sm,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: ContaTheme.colors.border,
    borderRadius: 4,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    marginRight: ContaTheme.spacing.sm,
    marginTop: 2,
    width: 22,
  },
  checkboxError: {
    borderColor: ContaTheme.colors.error,
  },
  checkboxMark: {
    color: ContaTheme.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxOn: {
    backgroundColor: ContaTheme.colors.primary,
    borderColor: ContaTheme.colors.primary,
  },
  politicaLink: {
    color: ContaTheme.colors.primaryStrong,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  politicaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  politicaText: {
    color: ContaTheme.colors.text,
    flex: 1,
    fontSize: ContaTheme.typography.caption,
    lineHeight: 20,
  },
  backButton: {
    alignItems: 'center',
    marginTop: ContaTheme.spacing.md,
  },
  backButtonText: {
    color: ContaTheme.colors.title,
    fontSize: 15,
    fontWeight: '600',
  },
  inlineField: {
    width: '48%',
  },
  inlineFields: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

function formatCepValue(cep: string) {
  return cep.length === 9 ? cep : `${cep.slice(0, 5)}-${cep.slice(5)}`;
}
