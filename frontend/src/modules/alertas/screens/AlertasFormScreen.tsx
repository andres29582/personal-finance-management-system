import { useFinancialDraft } from '../../../shared/hooks/useFinancialDraft';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listDividas } from '../../dividas/services/dividaService';
import { Divida } from '../../dividas/types/divida';
import { listMetas } from '../../metas/services/metaService';
import { Meta } from '../../metas/types/meta';
import { listOrcamentos } from '../../orcamentos/services/orcamentoService';
import { Orcamento } from '../../orcamentos/types/orcamento';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  AppShell,
  FinanceAppHeader,
  GlassButton,
  GlassField,
  GlassOptionGroup,
  GlassPanel,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { createAlerta, getAlertaById, updateAlerta } from '../services/alertaService';
import { TipoAlerta } from '../types/alerta';

export function AlertasFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const alertaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const draft = useFinancialDraft('alert/' + (alertaId ?? 'new'), {
    diasAnticipacion: '3',
    ...(alertaId
      ? {}
      : { tipo: 'vencimento_meta' as TipoAlerta, referenciaId: '' }),
  });
  const [lockedFields, setLockedFields] = useState({ tipo: 'vencimento_meta' as TipoAlerta, referenciaId: '' });
  const diasAnticipacion = draft.fields.diasAnticipacion;
  const setDiasAnticipacion = (value: string) => draft.setField("diasAnticipacion", value);
  const tipo = alertaId ? lockedFields.tipo : (draft.fields.tipo ?? 'vencimento_meta' as TipoAlerta);
  const setTipo = (value: TipoAlerta) => { if (alertaId) setLockedFields(current => ({...current, tipo: value})); else draft.setField("tipo", value); };
  const referenciaId = alertaId ? lockedFields.referenciaId : (draft.fields.referenciaId ?? '');
  const setReferenciaId = (value: string) => { if (alertaId) setLockedFields(current => ({...current, referenciaId: value})); else draft.setField("referenciaId", value); };



  const [metas, setMetas] = useState<Meta[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
    const loadScope = draft.capture();
    if (!draft.isCurrent(loadScope)) return;
      try {
        setLoading(true);
        const [metasData, dividasData, orcamentosData] = await Promise.all([
          listMetas(),
          listDividas(),
          listOrcamentos(),
        ]);
        if (!draft.isCurrent(loadScope)) return;
        setMetas(metasData);
        setDividas(dividasData);
        setOrcamentos(orcamentosData);

        if (alertaId) {
          const alerta = await getAlertaById(alertaId);
          if (!draft.isCurrent(loadScope)) return;
          setTipo(alerta.tipo);
          setReferenciaId(alerta.referenciaId);
          draft.hydrate({ diasAnticipacion: String(alerta.diasAnticipacion) });
        }
      } catch (error) {
        if (!draft.isCurrent(loadScope)) return;
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar o alerta.');
        if (!draft.isCurrent(loadScope)) return;
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        if (draft.isCurrent()) setLoading(false);
      }
    }

    void loadData();
  }, [alertaId, router]);

  const referenciaOptions = useMemo(() => {
    if (tipo === 'vencimento_meta') {
      return metas.map((meta) => ({ label: meta.nome, value: meta.id }));
    }

    if (tipo === 'vencimento_divida') {
      return dividas.map((divida) => ({ label: divida.nome, value: divida.id }));
    }

    return orcamentos.map((orcamento) => ({
      label: orcamento.mesReferencia,
      value: orcamento.id,
    }));
  }, [dividas, metas, orcamentos, tipo]);

  const selectedReferenceLabel =
    referenciaOptions.find((option) => option.value === referenciaId)?.label ??
    'Referência indisponível';

  async function handleSave() {
    const submitted = draft.capture();
    if (!draft.isCurrent(submitted)) return;
    const parsedDays = Number(diasAnticipacion);

    if (
      (!alertaId && !referenciaOptions.some((option) => option.value === referenciaId)) ||
      !Number.isInteger(parsedDays) ||
      parsedDays < 1
    ) {
      setMessage('Informe uma referencia e dias de antecipacao validos.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      if (alertaId) {
        await updateAlerta(alertaId, { diasAnticipacion: parsedDays });
      } else {
        await createAlerta({
          diasAnticipacion: parsedDays,
          referenciaId,
          tipo,
        });
      }

      if (!draft.isCurrent(submitted)) return;

      draft.clear(submitted);

      router.replace('/alertas' as never);
    } catch (error) {
      if (!draft.isCurrent(submitted)) return;
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar o alerta.');
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
      activeRoute="/alertas"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => { draft.clear(); router.back(); }} variant="ghost" />}
          eyebrow="Monitoramento"
          subtitle="Configure lembretes para metas, dividas e limites."
          title={alertaId ? 'Editar alerta' : 'Novo alerta'}
        />
      }
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando alerta...</Text>
          </View>
        </GlassPanel>
      ) : (
        <GlassPanel>
          <GlassField label="Tipo">
            {alertaId ? (
              <GlassTextInput
                editable={false}
                value={
                  tipo === 'vencimento_meta'
                    ? 'Meta'
                    : tipo === 'vencimento_divida'
                      ? 'Divida'
                      : 'Limite gasto'
                }
              />
            ) : (
              <GlassOptionGroup
                options={[
                  { label: 'Meta', value: 'vencimento_meta' },
                  { label: 'Divida', value: 'vencimento_divida' },
                  { label: 'Limite gasto', value: 'limite_gasto' },
                ]}
                value={tipo}
                onChange={(value) => {
                  setTipo(value as TipoAlerta);
                  setReferenciaId('');
                }}
              />
            )}
          </GlassField>

          <GlassField label="Referencia">
            {alertaId ? (
              <GlassTextInput editable={false} value={selectedReferenceLabel} />
            ) : (
              <GlassOptionGroup
                options={referenciaOptions}
                value={referenciaId}
                onChange={setReferenciaId}
              />
            )}
          </GlassField>

          <GlassField label="Dias de antecipacao">
            <GlassTextInput
              keyboardType="number-pad"
              value={diasAnticipacion}
              onChangeText={setDiasAnticipacion}
            />
          </GlassField>

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
          <GlassButton
            label={saving ? 'Salvando...' : 'Salvar alerta'}
            onPress={handleSave}
            disabled={saving}
          />
        </GlassPanel>
      )}
    </AppShell>
  );
}

export default AlertasFormScreen;

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
