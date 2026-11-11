import { useFinancialDraft } from '../../../shared/hooks/useFinancialDraft';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getContaById, listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import { getDividaById, listDividas } from '../../dividas/services/dividaService';
import { Divida } from '../../dividas/types/divida';
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
import { getLocalDateInputValue } from '../../../../utils/formatters';
import { parseDecimalInput } from '../../../../utils/number-input';
import { createMeta, getMetaById, updateMeta } from '../services/metaService';
import { TipoMeta } from '../types/meta';

export function MetasFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const metaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const draft = useFinancialDraft('goal/' + (metaId ?? 'new'), {
    nome: '',
    montoObjetivo: '',
    fechaLimite: getLocalDateInputValue(),
    ...(metaId
      ? {}
      : { tipo: 'economia' as TipoMeta, contaId: '', dividaId: '' }),
    ...(metaId ? { montoActual: '' } : {}),
  });
  const [lockedFields, setLockedFields] = useState({ tipo: 'economia' as TipoMeta, contaId: '', dividaId: '' });
  const nome = draft.fields.nome;
  const setNome = (value: string) => draft.setField("nome", value);
  const montoObjetivo = draft.fields.montoObjetivo;
  const setMontoObjetivo = (value: string) => draft.setField("montoObjetivo", value);
  const fechaLimite = draft.fields.fechaLimite;
  const setFechaLimite = (value: string) => draft.setField("fechaLimite", value);
  const tipo = metaId ? lockedFields.tipo : (draft.fields.tipo ?? 'economia' as TipoMeta);
  const setTipo = (value: TipoMeta) => { if (metaId) setLockedFields(current => ({...current, tipo: value})); else draft.setField("tipo", value); };
  const contaId = metaId ? lockedFields.contaId : (draft.fields.contaId ?? '');
  const setContaId = (value: string) => { if (metaId) setLockedFields(current => ({...current, contaId: value})); else draft.setField("contaId", value); };
  const dividaId = metaId ? lockedFields.dividaId : (draft.fields.dividaId ?? '');
  const setDividaId = (value: string) => { if (metaId) setLockedFields(current => ({...current, dividaId: value})); else draft.setField("dividaId", value); };
  const montoActual = draft.fields.montoActual ?? '';
  const setMontoActual = (value: string) => draft.setField("montoActual", value);







  const [contas, setContas] = useState<Conta[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
    const loadScope = draft.capture();
    if (!draft.isCurrent(loadScope)) return;
      try {
        setLoading(true);
        const [contasData, dividasData] = await Promise.all([
          listContas(),
          listDividas(),
        ]);
        if (!draft.isCurrent(loadScope)) return;
        if (metaId) {
          const meta = await getMetaById(metaId);
          if (!draft.isCurrent(loadScope)) return;
          const [conta, divida] = await Promise.all([
            meta.contaId && !contasData.some(({ id }) => id === meta.contaId)
              ? getContaById(meta.contaId)
              : undefined,
            meta.dividaId && !dividasData.some(({ id }) => id === meta.dividaId)
              ? getDividaById(meta.dividaId)
              : undefined,
          ]);
          if (!draft.isCurrent(loadScope)) return;
          setContas(conta ? [...contasData, conta] : contasData);
          setDividas(divida ? [...dividasData, divida] : dividasData);
          setLockedFields({ tipo: meta.tipo, contaId: meta.contaId || '', dividaId: meta.dividaId || '' });
          draft.hydrate({ nome: meta.nome, montoObjetivo: String(meta.montoObjetivo), montoActual: String(meta.montoActual), fechaLimite: meta.fechaLimite });
        } else {
          setContas(contasData);
          setDividas(dividasData);
        }
      } catch (error) {
        if (!draft.isCurrent(loadScope)) return;
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar a meta.');
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
  }, [metaId, router]);

  async function handleSave() {
    const submitted = draft.capture();
    if (!draft.isCurrent(submitted)) return;
    const objetivo = parseDecimalInput(montoObjetivo);
    const actual = parseDecimalInput(montoActual);

    const parsedDueDate = new Date(`${fechaLimite}T00:00:00.000Z`);
    const validDueDate =
      /^\d{4}-\d{2}-\d{2}$/.test(fechaLimite) &&
      !Number.isNaN(parsedDueDate.getTime()) &&
      parsedDueDate.toISOString().slice(0, 10) === fechaLimite;

    if (!nome.trim() || !Number.isFinite(objetivo) || !validDueDate) {
      setMessage('Preencha nome, objetivo e data limite.');
      return;
    }

    if (objetivo <= 0) {
      setMessage('O objetivo deve ser maior que zero.');
      return;
    }

    if (metaId && (!Number.isFinite(actual) || actual < 0)) {
      setMessage('O valor atual deve ser maior ou igual a zero.');
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

      if (!draft.isCurrent(submitted)) return;

      draft.clear(submitted);

      router.replace('/metas' as never);
    } catch (error) {
      if (!draft.isCurrent(submitted)) return;
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar a meta.');
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
      activeRoute="/metas"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => { draft.clear(); router.back(); }} variant="ghost" />}
          eyebrow="Planejamento"
          subtitle="Defina objetivos e acompanhe progresso financeiro."
          title={metaId ? 'Editar meta' : 'Nova meta'}
        />
      }
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
            {metaId ? (
              <GlassTextInput
                editable={false}
                value={tipo === 'economia' ? 'Economia' : 'Reducao divida'}
              />
            ) : (
              <GlassOptionGroup
                options={[
                  { label: 'Economia', value: 'economia' },
                  { label: 'Reducao divida', value: 'reducao_divida' },
                ]}
                value={tipo}
                onChange={(value) => setTipo(value as TipoMeta)}
              />
            )}
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
            {metaId ? (
              <GlassTextInput
                editable={false}
                value={contas.find((conta) => conta.id === contaId)?.nome ?? 'Nenhuma'}
              />
            ) : (
              <GlassOptionGroup
                options={[
                  { label: 'Nenhuma', value: '' },
                  ...contas.map((conta) => ({ label: conta.nome, value: conta.id })),
                ]}
                value={contaId}
                onChange={setContaId}
              />
            )}
          </GlassField>

          <GlassField label="Divida vinculada">
            {metaId ? (
              <GlassTextInput
                editable={false}
                value={dividas.find((divida) => divida.id === dividaId)?.nome ?? 'Nenhuma'}
              />
            ) : (
              <GlassOptionGroup
                options={[
                  { label: 'Nenhuma', value: '' },
                  ...dividas.map((divida) => ({ label: divida.nome, value: divida.id })),
                ]}
                value={dividaId}
                onChange={setDividaId}
              />
            )}
          </GlassField>

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
          <GlassButton
            label={saving ? 'Salvando...' : 'Salvar meta'}
            onPress={handleSave}
            disabled={saving}
          />
        </GlassPanel>
      )}
    </AppShell>
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
