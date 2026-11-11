import { useFinancialDraft } from '../../../shared/hooks/useFinancialDraft';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  AppShell,
  FinanceAppHeader,
  GlassButton,
  GlassField,
  GlassPanel,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { getCurrentMonthReference } from '../../../../utils/formatters';
import { parseDecimalInput } from '../../../../utils/number-input';
import {
  createOrcamento,
  getOrcamentoById,
  updateOrcamento,
} from '../services/orcamentoService';

export function OrcamentoFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const orcamentoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const draft = useFinancialDraft('budget/' + (orcamentoId ?? 'new'), {
    valorPlanejado: '',
    ...(orcamentoId ? {} : { mesReferencia: getCurrentMonthReference() }),
  });
  const [lockedFields, setLockedFields] = useState({ mesReferencia: getCurrentMonthReference() });
  const valorPlanejado = draft.fields.valorPlanejado;
  const setValorPlanejado = (value: string) => draft.setField("valorPlanejado", value);
  const mesReferencia = orcamentoId ? lockedFields.mesReferencia : (draft.fields.mesReferencia ?? getCurrentMonthReference());
  const setMesReferencia = (value: string) => { if (orcamentoId) setLockedFields(current => ({...current, mesReferencia: value})); else draft.setField("mesReferencia", value); };


  const [loading, setLoading] = useState(!!orcamentoId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadOrcamento() {
    const loadScope = draft.capture();
    if (!draft.isCurrent(loadScope)) return;
      if (!orcamentoId) {
        return;
      }

      try {
        setLoading(true);
        const orcamento = await getOrcamentoById(orcamentoId);
        if (!draft.isCurrent(loadScope)) return;
        setMesReferencia(orcamento.mesReferencia);
        draft.hydrate({ valorPlanejado: String(orcamento.valorPlanejado) });
      } catch (error) {
        if (!draft.isCurrent(loadScope)) return;
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o orcamento.',
        );
        if (!draft.isCurrent(loadScope)) return;
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        if (draft.isCurrent()) setLoading(false);
      }
    }

    void loadOrcamento();
  }, [orcamentoId, router]);

  async function handleSave() {
    const submitted = draft.capture();
    if (!draft.isCurrent(submitted)) return;
    const parsedValue = parseDecimalInput(valorPlanejado);

    if (!mesReferencia || !Number.isFinite(parsedValue)) {
      setMessage('Informe mes e valor planejado validos.');
      return;
    }

    if (parsedValue <= 0) {
      setMessage('O valor planejado deve ser maior que zero.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      if (orcamentoId) {
        await updateOrcamento(orcamentoId, { valorPlanejado: parsedValue });
      } else {
        await createOrcamento({
          mesReferencia,
          valorPlanejado: parsedValue,
        });
      }

      if (!draft.isCurrent(submitted)) return;

      draft.clear(submitted);

      router.replace('/orcamentos' as never);
    } catch (error) {
      if (!draft.isCurrent(submitted)) return;
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel salvar o orcamento.',
      );
      if (!draft.isCurrent(submitted)) return;
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (draft.isCurrent()) setSaving(false);
    }
  }

  return (
    <AppShell
      activeRoute="/orcamentos"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => { draft.clear(); router.back(); }} variant="ghost" />}
          eyebrow="Planejamento"
          subtitle="Defina o limite planejado para o mes."
          title={orcamentoId ? 'Editar orcamento' : 'Novo orcamento'}
        />
      }
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando orcamento...</Text>
          </View>
        </GlassPanel>
      ) : (
        <GlassPanel>
          <GlassField label="Mes de referencia (YYYY-MM)">
            <GlassTextInput
              editable={!orcamentoId}
              placeholder="2026-04"
              value={mesReferencia}
              onChangeText={setMesReferencia}
            />
          </GlassField>

          <GlassField label="Valor planejado">
            <GlassTextInput
              keyboardType="decimal-pad"
              placeholder="0,00"
              value={valorPlanejado}
              onChangeText={setValorPlanejado}
            />
          </GlassField>

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
          <GlassButton
            label={saving ? 'Salvando...' : 'Salvar orcamento'}
            onPress={handleSave}
            disabled={saving}
          />
        </GlassPanel>
      )}
    </AppShell>
  );
}

export default OrcamentoFormScreen;

const styles = StyleSheet.create({
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
  },
  loadingText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
});
