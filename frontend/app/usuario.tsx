import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppMessage } from '../components/app-message';
import {
  AppCard,
  AppField,
  AppScreen,
  AppStatusCard,
  appInputStyles,
} from '../components/app-screen';
import { ContaTheme } from '../constants/contas-theme';
import { useCepAutofill } from '../hooks/use-cep-autofill';
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from '../services/userService';
import { saveUser } from '../storage/authStorage';
import { CepLookupResponse } from '../types/cep';
import { UserProfile } from '../types/user';
import { resolveApiError } from '../utils/api-error';
import {
  formatCpfInput,
  isValidCep,
  isValidCpf,
} from '../utils/br-input';
import { formatDate } from '../utils/formatters';

type UserField =
  | 'cep'
  | 'cidade'
  | 'cpf'
  | 'email'
  | 'endereco'
  | 'nome'
  | 'numero';

type UserErrors = Partial<Record<UserField, string>>;

export default function UsuarioScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [cidade, setCidade] = useState('');
  const [errors, setErrors] = useState<UserErrors>({});
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    disabled: loading || saving,
    onResolved: applyCepLookup,
  });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const user = await getCurrentUserProfile();
      setProfile(user);
      await saveUser(user);
      setNome(user.nome ?? '');
      setEmail(user.email ?? '');
      setCpf(user.cpf ? formatCpfInput(user.cpf) : '');
      setCep(user.cep ? formatCepValue(user.cep) : '');
      setEndereco(user.endereco ?? '');
      setNumero(user.numero ?? '');
      setCidade(user.cidade ?? '');
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel carregar seus dados.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  function validateForm(): UserErrors {
    const nextErrors: UserErrors = {};

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

    return nextErrors;
  }

  async function handleSave() {
    const validationErrors = validateForm();
    setErrors(validationErrors);
    setMessage('');
    setSuccessMessage('');

    if (Object.keys(validationErrors).length > 0) {
      setMessage('Revise os campos destacados para salvar.');
      return;
    }

    try {
      setSaving(true);
      const updatedUser = await updateCurrentUserProfile({
        cep,
        cidade: cidade.trim(),
        cpf,
        email: email.trim(),
        endereco: endereco.trim(),
        nome: nome.trim(),
        numero: numero.trim(),
      });
      setProfile(updatedUser);
      await saveUser(updatedUser);
      setNome(updatedUser.nome ?? '');
      setEmail(updatedUser.email ?? '');
      setCpf(updatedUser.cpf ? formatCpfInput(updatedUser.cpf) : '');
      setCep(updatedUser.cep ? formatCepValue(updatedUser.cep) : '');
      setEndereco(updatedUser.endereco ?? '');
      setNumero(updatedUser.numero ?? '');
      setCidade(updatedUser.cidade ?? '');
      setSuccessMessage('Perfil atualizado com sucesso.');
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel salvar seus dados.',
        {
          400: 'Confira CPF, CEP e os demais dados informados.',
          409: 'Ja existe outro usuario com este e-mail ou CPF.',
        },
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen
      title="Meu perfil"
      subtitle={profile?.dataRegistro ? `Cadastro em ${formatDate(profile.dataRegistro)}` : 'Atualize seus dados pessoais'}
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard' as never)}
      actionLabel="Atualizar"
      onActionPress={loadProfile}
    >
      {loading && !profile ? (
        <AppStatusCard
          title="Carregando perfil"
          description="Estamos buscando seus dados mais recentes."
          loading
        />
      ) : null}

      {!loading && !!message && !profile ? (
        <AppStatusCard
          title="Nao foi possivel carregar o perfil"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadProfile}
        />
      ) : null}

      {!loading && !message && !profile ? (
        <AppStatusCard
          title="Perfil indisponivel"
          description="Nao encontramos informacoes suficientes para montar esta tela."
          actionLabel="Atualizar"
          onActionPress={loadProfile}
        />
      ) : null}

      {profile ? (
        <>
          <AppCard>
            <Text style={styles.sectionTitle}>Informacoes pessoais</Text>

            <AppField label="Nome completo" error={errors.nome}>
              <TextInput
                style={[appInputStyles.input, errors.nome ? appInputStyles.inputError : null]}
                value={nome}
                onChangeText={(value) => {
                  setNome(value);
                  setErrors((current) => ({ ...current, nome: undefined }));
                }}
                editable={!loading && !saving}
                placeholder="Seu nome completo"
              />
            </AppField>

            <AppField label="E-mail" error={errors.email}>
              <TextInput
                style={[appInputStyles.input, errors.email ? appInputStyles.inputError : null]}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setErrors((current) => ({ ...current, email: undefined }));
                }}
                editable={!loading && !saving}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="voce@exemplo.com"
              />
            </AppField>

            <AppField label="CPF" error={errors.cpf}>
              <TextInput
                style={[appInputStyles.input, errors.cpf ? appInputStyles.inputError : null]}
                value={cpf}
                onChangeText={(value) => {
                  setCpf(formatCpfInput(value));
                  setErrors((current) => ({ ...current, cpf: undefined }));
                }}
                editable={!loading && !saving}
                keyboardType="number-pad"
                maxLength={14}
                placeholder="000.000.000-00"
              />
            </AppField>
          </AppCard>

          <AppCard>
            <Text style={styles.sectionTitle}>Endereco</Text>

            <AppField label="CEP" error={errors.cep}>
              <TextInput
                style={[appInputStyles.input, errors.cep ? appInputStyles.inputError : null]}
                value={cep}
                onChangeText={(value) => {
                  setCep(handleCepValueChange(value));
                  setErrors((current) => ({ ...current, cep: undefined }));
                }}
                editable={!loading && !saving}
                keyboardType="number-pad"
                maxLength={9}
                placeholder="00000-000"
              />
            </AppField>
            <AppMessage
              tone={cepLookupTone}
              value={cepLookupLoading || cepLookupMessage ? cepLookupMessage : undefined}
            />

            <AppField label="Endereco" error={errors.endereco}>
              <TextInput
                style={[appInputStyles.input, errors.endereco ? appInputStyles.inputError : null]}
                value={endereco}
                onChangeText={(value) => {
                  setEndereco(value);
                  setErrors((current) => ({ ...current, endereco: undefined }));
                }}
                editable={!loading && !saving}
                placeholder="Rua, avenida ou logradouro"
              />
            </AppField>

            <AppField label="Numero" error={errors.numero}>
              <TextInput
                style={[appInputStyles.input, errors.numero ? appInputStyles.inputError : null]}
                value={numero}
                onChangeText={(value) => {
                  setNumero(value);
                  setErrors((current) => ({ ...current, numero: undefined }));
                }}
                editable={!loading && !saving}
                placeholder="123 ou S/N"
              />
            </AppField>

            <AppField label="Cidade" error={errors.cidade}>
              <TextInput
                style={[appInputStyles.input, errors.cidade ? appInputStyles.inputError : null]}
                value={cidade}
                onChangeText={(value) => {
                  setCidade(value);
                  setErrors((current) => ({ ...current, cidade: undefined }));
                }}
                editable={!loading && !saving}
                placeholder="Sua cidade"
              />
            </AppField>
          </AppCard>

          <AppCard>
            <Text style={styles.metaLabel}>
              Moeda padrao: {profile.moedaPadrao ?? 'BRL'}
            </Text>
            <AppMessage tone="error" value={message} />
            <AppMessage tone="success" value={successMessage} />
            <AppButton
              label={saving ? 'Salvando...' : 'Salvar alteracoes'}
              onPress={handleSave}
              disabled={loading || saving}
            />
          </AppCard>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metaLabel: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '600',
    marginBottom: ContaTheme.spacing.sm,
  },
  sectionTitle: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
    marginBottom: ContaTheme.spacing.sm,
  },
});

function formatCepValue(cep: string) {
  return cep.length === 9 ? cep : `${cep.slice(0, 5)}-${cep.slice(5)}`;
}
