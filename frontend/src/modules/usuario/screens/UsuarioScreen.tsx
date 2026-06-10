import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { saveUser } from '../../../../storage/authStorage';
import {
  formatCpfInput,
  isValidCep,
  isValidCpf,
} from '../../../../utils/br-input';
import { resolveApiError } from '../../../../utils/api-error';
import { formatDate } from '../../../../utils/formatters';
import { useCepAutofill } from '../../../shared/hooks/use-cep-autofill';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassPanel,
  GlassStatusCard,
  GlassTextInput,
} from '../../../shared/ui';
import { CepLookupResponse } from '../../../shared/types/cep';
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from '../services/userService';
import { UserProfile } from '../types/user';

type UserField =
  | 'cep'
  | 'cidade'
  | 'cpf'
  | 'email'
  | 'endereco'
  | 'nome'
  | 'numero';

type UserErrors = Partial<Record<UserField, string>>;

export function UsuarioScreen() {
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
      void loadProfile();
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
    <FinanceAppShell
      activeRoute="/usuario"
      header={
        <FinanceAppHeader
          action={
            <View style={styles.headerActions}>
              <GlassButton label="Voltar" onPress={() => router.replace('/dashboard' as never)} variant="ghost" />
              <GlassButton label="Atualizar" onPress={loadProfile} variant="ghost" />
            </View>
          }
          eyebrow="Conta e privacidade"
          subtitle={
            profile?.dataRegistro
              ? `Cadastro em ${formatDate(profile.dataRegistro)}`
              : 'Atualize seus dados pessoais'
          }
          title="Meu perfil"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {loading && !profile ? (
        <GlassStatusCard
          title="Carregando perfil"
          description="Estamos buscando seus dados mais recentes."
          loading
        />
      ) : null}

      {!loading && !!message && !profile ? (
        <GlassStatusCard
          title="Nao foi possivel carregar o perfil"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadProfile}
        />
      ) : null}

      {!loading && !message && !profile ? (
        <GlassStatusCard
          title="Perfil indisponivel"
          description="Nao encontramos informacoes suficientes para montar esta tela."
          actionLabel="Atualizar"
          onActionPress={loadProfile}
        />
      ) : null}

      {profile ? (
        <>
          <GlassPanel>
            <Text style={styles.sectionTitle}>Informacoes pessoais</Text>

            <GlassField label="Nome completo" error={errors.nome}>
              <GlassTextInput
                value={nome}
                onChangeText={(value) => {
                  setNome(value);
                  setErrors((current) => ({ ...current, nome: undefined }));
                }}
                editable={!loading && !saving}
                placeholder="Seu nome completo"
              />
            </GlassField>

            <GlassField label="E-mail" error={errors.email}>
              <GlassTextInput
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
            </GlassField>

            <GlassField label="CPF" error={errors.cpf}>
              <GlassTextInput
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
            </GlassField>
          </GlassPanel>

          <GlassPanel>
            <Text style={styles.sectionTitle}>Endereco</Text>

            <GlassField label="CEP" error={errors.cep}>
              <GlassTextInput
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
            </GlassField>
            {cepLookupLoading || cepLookupMessage ? (
              <Text style={[styles.lookupMessage, lookupStyles[cepLookupTone]]}>
                {cepLookupMessage}
              </Text>
            ) : null}

            <GlassField label="Endereco" error={errors.endereco}>
              <GlassTextInput
                value={endereco}
                onChangeText={(value) => {
                  setEndereco(value);
                  setErrors((current) => ({ ...current, endereco: undefined }));
                }}
                editable={!loading && !saving}
                placeholder="Rua, avenida ou logradouro"
              />
            </GlassField>

            <GlassField label="Numero" error={errors.numero}>
              <GlassTextInput
                value={numero}
                onChangeText={(value) => {
                  setNumero(value);
                  setErrors((current) => ({ ...current, numero: undefined }));
                }}
                editable={!loading && !saving}
                placeholder="123 ou S/N"
              />
            </GlassField>

            <GlassField label="Cidade" error={errors.cidade}>
              <GlassTextInput
                value={cidade}
                onChangeText={(value) => {
                  setCidade(value);
                  setErrors((current) => ({ ...current, cidade: undefined }));
                }}
                editable={!loading && !saving}
                placeholder="Sua cidade"
              />
            </GlassField>
          </GlassPanel>

          <GlassPanel>
            <Text style={styles.metaLabel}>
              Moeda padrao: {profile.moedaPadrao ?? 'BRL'}
            </Text>
            {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
            {successMessage ? <Text style={styles.successMessage}>{successMessage}</Text> : null}
            <GlassButton
              label={saving ? 'Salvando...' : 'Salvar alteracoes'}
              onPress={handleSave}
              disabled={loading || saving}
            />
          </GlassPanel>
        </>
      ) : null}
    </FinanceAppShell>
  );
}

const styles = StyleSheet.create({
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
  },
  lookupMessage: {
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    marginTop: -FinanceTheme.spacing.xs,
  },
  metaLabel: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
  },
  sectionTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  successMessage: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
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

export default UsuarioScreen;
