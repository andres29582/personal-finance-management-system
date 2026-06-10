import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listDividas } from '../../dividas/services/dividaService';
import { Divida } from '../../dividas/types/divida';
import { listMetas } from '../../metas/services/metaService';
import { Meta } from '../../metas/types/meta';
import { listOrcamentos } from '../../orcamentos/services/orcamentoService';
import { Orcamento } from '../../orcamentos/types/orcamento';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
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
  const [tipo, setTipo] = useState<TipoAlerta>('vencimento_meta');
  const [referenciaId, setReferenciaId] = useState('');
  const [diasAnticipacion, setDiasAnticipacion] = useState('3');
  const [metas, setMetas] = useState<Meta[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [metasData, dividasData, orcamentosData] = await Promise.all([
          listMetas(),
          listDividas(),
          listOrcamentos(),
        ]);
        setMetas(metasData);
        setDividas(dividasData);
        setOrcamentos(orcamentosData);

        if (alertaId) {
          const alerta = await getAlertaById(alertaId);
          setTipo(alerta.tipo);
          setReferenciaId(alerta.referenciaId);
          setDiasAnticipacion(String(alerta.diasAnticipacion));
        }
      } catch (error) {
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar o alerta.');
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        setLoading(false);
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

  async function handleSave() {
    const parsedDays = Number(diasAnticipacion);

    if (!referenciaId || !Number.isInteger(parsedDays) || parsedDays < 1) {
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

      router.replace('/alertas' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar o alerta.');
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
      activeRoute="/alertas"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => router.back()} variant="ghost" />}
          eyebrow="Monitoramento"
          subtitle="Configure lembretes para metas, dividas e limites."
          title={alertaId ? 'Editar alerta' : 'Novo alerta'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
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
            <GlassOptionGroup
              options={[
                { label: 'Meta', value: 'vencimento_meta' },
                { label: 'Divida', value: 'vencimento_divida' },
                { label: 'Limite gasto', value: 'limite_gasto' },
              ]}
              value={tipo}
              onChange={(value) => setTipo(value as TipoAlerta)}
            />
          </GlassField>

          <GlassField label="Referencia">
            <GlassOptionGroup
              options={referenciaOptions}
              value={referenciaId}
              onChange={setReferenciaId}
            />
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
    </FinanceAppShell>
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
