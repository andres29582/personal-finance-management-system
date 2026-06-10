import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonthReference());
  const [valorPlanejado, setValorPlanejado] = useState('');
  const [loading, setLoading] = useState(!!orcamentoId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadOrcamento() {
      if (!orcamentoId) {
        return;
      }

      try {
        setLoading(true);
        const orcamento = await getOrcamentoById(orcamentoId);
        setMesReferencia(orcamento.mesReferencia);
        setValorPlanejado(String(orcamento.valorPlanejado));
      } catch (error) {
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o orcamento.',
        );
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadOrcamento();
  }, [orcamentoId, router]);

  async function handleSave() {
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

      router.replace('/orcamentos' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel salvar o orcamento.',
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
      activeRoute="/orcamentos"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => router.back()} variant="ghost" />}
          eyebrow="Planejamento"
          subtitle="Defina o limite planejado para o mes."
          title={orcamentoId ? 'Editar orcamento' : 'Novo orcamento'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
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
    </FinanceAppShell>
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
