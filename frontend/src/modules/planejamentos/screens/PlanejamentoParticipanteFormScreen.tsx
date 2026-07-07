import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassPanel,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { addParticipantePlanejamento } from '../services/planejamentoService';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string) {
  return !value || emailPattern.test(value);
}

export function PlanejamentoParticipanteFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planejamentoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(
    planejamentoId ? '' : 'Planejamento nao informado.',
  );
  const [saving, setSaving] = useState(false);

  function goBackToDetail() {
    if (planejamentoId) {
      router.replace({
        pathname: '/planejamentos-detail',
        params: { id: planejamentoId },
      } as never);
      return;
    }

    router.push('/planejamentos' as never);
  }

  async function handleSave() {
    const trimmedNome = nome.trim();
    const trimmedEmail = email.trim();

    if (!planejamentoId) {
      setMessage('Planejamento nao informado.');
      return;
    }

    if (!trimmedNome) {
      setMessage('Informe o nome do participante.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setMessage('Informe um email valido.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      await addParticipantePlanejamento(planejamentoId, {
        nome: trimmedNome,
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
      });

      goBackToDetail();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel adicionar o participante.',
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
      activeRoute="/planejamentos"
      header={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Voltar"
              onPress={goBackToDetail}
              variant="ghost"
            />
          }
          eyebrow="Planejamento compartilhado"
          subtitle="Adicione uma pessoa ao planejamento."
          title="Adicionar participante"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassField label="Nome">
          <GlassTextInput
            editable={!saving}
            maxLength={150}
            onChangeText={setNome}
            placeholder="Nome do participante"
            value={nome}
          />
        </GlassField>

        <GlassField label="Email">
          <GlassTextInput
            autoCapitalize="none"
            editable={!saving}
            keyboardType="email-address"
            maxLength={150}
            onChangeText={setEmail}
            placeholder="email@exemplo.com"
            value={email}
          />
        </GlassField>

        {message ? <Text style={styles.errorMessage}>{message}</Text> : null}

        <GlassButton
          disabled={saving || !planejamentoId}
          label={saving ? 'Salvando...' : 'Salvar participante'}
          onPress={handleSave}
        />
      </GlassPanel>
    </FinanceAppShell>
  );
}

export default PlanejamentoParticipanteFormScreen;

const styles = StyleSheet.create({
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
});
