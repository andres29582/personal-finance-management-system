import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import { listDividas } from '../../dividas/services/dividaService';
import { Divida } from '../../dividas/types/divida';
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
import { parseDecimalInput } from '../../../../utils/number-input';
import { createMeta, getMetaById, updateMeta } from '../services/metaService';
import { TipoMeta } from '../types/meta';

export function MetasFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const metaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoMeta>('economia');
  const [montoObjetivo, setMontoObjetivo] = useState('');
  const [montoActual, setMontoActual] = useState('');
  const [fechaLimite, setFechaLimite] = useState(new Date().toISOString().slice(0, 10));
  const [contaId, setContaId] = useState('');
  const [dividaId, setDividaId] = useState('');
  const [contas, setContas] = useState<Conta[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [contasData, dividasData] = await Promise.all([
          listContas(),
          listDividas(),
        ]);
        setContas(contasData);
        setDividas(dividasData);

        if (metaId) {
          const meta = await getMetaById(metaId);
          setNome(meta.nome);
          setTipo(meta.tipo);
          setMontoObjetivo(String(meta.montoObjetivo));
          setMontoActual(String(meta.montoActual));
          setFechaLimite(meta.fechaLimite);
          setContaId(meta.contaId || '');
          setDividaId(meta.dividaId || '');
        }
      } catch (error) {
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar a meta.');
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [metaId, router]);

  async function handleSave() {
    const objetivo = parseDecimalInput(montoObjetivo);
    const actual = parseDecimalInput(montoActual);

    if (!nome.trim() || !Number.isFinite(objetivo) || !fechaLimite) {
      setMessage('Preencha nome, objetivo e data limite.');
      return;
    }

    if (objetivo <= 0) {
      setMessage('O objetivo deve ser maior que zero.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      if (metaId) {
        await updateMeta(metaId, {
          fechaLimite,
          montoActual: Number.isFinite(actual) ? actual : 0,
          montoObjetivo: objetivo,
          nome: nome.trim(),
        });
      } else {
        await createMeta({
          contaId: contaId || undefined,
          dividaId: dividaId || undefined,
          fechaLimite,
          montoObjetivo: objetivo,
          nome: nome.trim(),
          tipo,
        });
      }

      router.replace('/metas' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar a meta.');
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
      activeRoute="/metas"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => router.back()} variant="ghost" />}
          eyebrow="Planejamento"
          subtitle="Defina objetivos e acompanhe progresso financeiro."
          title={metaId ? 'Editar meta' : 'Nova meta'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando meta...</Text>
          </View>
        </GlassPanel>
      ) : (
        <GlassPanel>
          <GlassField label="Nome">
            <GlassTextInput value={nome} onChangeText={setNome} />
          </GlassField>

          <GlassField label="Tipo">
            <GlassOptionGroup
              options={[
                { label: 'Economia', value: 'economia' },
                { label: 'Reducao divida', value: 'reducao_divida' },
              ]}
              value={tipo}
              onChange={(value) => setTipo(value as TipoMeta)}
            />
          </GlassField>

          <GlassField label="Valor objetivo">
            <GlassTextInput
              keyboardType="decimal-pad"
              value={montoObjetivo}
              onChangeText={setMontoObjetivo}
            />
          </GlassField>

          {metaId ? (
            <GlassField label="Valor atual">
              <GlassTextInput
                keyboardType="decimal-pad"
                value={montoActual}
                onChangeText={setMontoActual}
              />
            </GlassField>
          ) : null}

          <GlassField label="Data limite">
            <GlassTextInput
              placeholder="2026-12-31"
              value={fechaLimite}
              onChangeText={setFechaLimite}
            />
          </GlassField>

          <GlassField label="Conta vinculada">
            <GlassOptionGroup
              options={[
                { label: 'Nenhuma', value: '' },
                ...contas.map((conta) => ({ label: conta.nome, value: conta.id })),
              ]}
              value={contaId}
              onChange={setContaId}
            />
          </GlassField>

          <GlassField label="Divida vinculada">
            <GlassOptionGroup
              options={[
                { label: 'Nenhuma', value: '' },
                ...dividas.map((divida) => ({ label: divida.nome, value: divida.id })),
              ]}
              value={dividaId}
              onChange={setDividaId}
            />
          </GlassField>

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
          <GlassButton
            label={saving ? 'Salvando...' : 'Salvar meta'}
            onPress={handleSave}
            disabled={saving}
          />
        </GlassPanel>
      )}
    </FinanceAppShell>
  );
}

export default MetasFormScreen;

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
