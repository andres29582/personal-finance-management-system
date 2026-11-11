import { useFinancialDraft } from '../../../shared/hooks/useFinancialDraft';
import { prepareTransferIntent, isUnknownTransferOutcome, TransferIntent } from '../utils/transferIntent';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
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
import {
  createTransferencia,
  getTransferenciaById,
  updateTransferencia,
} from '../services/transferenciaService';
import { isValidDateInput } from '../../../shared/validators/dateInput';

export function TransferenciaFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const transferenciaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [contas, setContas] = useState<Conta[]>([]);
  const draft = useFinancialDraft('transfer/' + (transferenciaId ?? 'new'), {
    contaOrigemId: '', contaDestinoId: '', valor: '', comissao: '',
    data: getLocalDateInputValue(), descricao: '', intent: null as TransferIntent | null,
  });
  const { contaOrigemId, contaDestinoId, valor, comissao, data, descricao, intent } = draft.fields;
  const setContaOrigemId = (value: string) => draft.setField('contaOrigemId', value);
  const setContaDestinoId = (value: string) => draft.setField('contaDestinoId', value);
  const setValor = (value: string) => draft.setField('valor', value);
  const setComissao = (value: string) => draft.setField('comissao', value);
  const setData = (value: string) => draft.setField('data', value);
  const setDescricao = (value: string) => draft.setField('descricao', value);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const sending = useRef(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        const contasData = await listContas();
        if (cancelled) return;
        setContas(contasData);

        if (transferenciaId) {
          const transferencia = await getTransferenciaById(transferenciaId);
          if (cancelled) return;
          draft.hydrate({ contaOrigemId: transferencia.contaOrigemId,
            contaDestinoId: transferencia.contaDestinoId, valor: String(transferencia.valor),
            comissao: String(transferencia.comissao), data: transferencia.data,
            descricao: transferencia.descricao || '' });
        } else {
          draft.hydrate({ contaOrigemId: contasData[0]?.id ?? '', contaDestinoId: contasData[1]?.id ?? contasData[0]?.id ?? '' });
        }
      } catch (error) {
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar a transferencia.',
        );
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => { cancelled = true; };
  }, [router, transferenciaId]);

  async function handleSave() {
    if (sending.current) return;
    const parsedValor = parseDecimalInput(valor);
    const parsedComissao = comissao.trim() ? parseDecimalInput(comissao) : 0;

    if (!contaOrigemId || !contaDestinoId || !Number.isFinite(parsedValor) || !data) {
      setMessage('Preencha origem, destino, valor e data.');
      return;
    }

    if (!isValidDateInput(data)) {
      setMessage('Informe uma data valida no formato YYYY-MM-DD.');
      return;
    }

    if (parsedValor <= 0) {
      setMessage('O valor deve ser maior que zero.');
      return;
    }

    if (!Number.isFinite(parsedComissao) || parsedComissao < 0) {
      setMessage('Informe uma comissao valida maior ou igual a zero.');
      return;
    }

    if (contaOrigemId === contaDestinoId) {
      setMessage('Conta origem e destino devem ser diferentes.');
      return;
    }

    const payload = { comissao: parsedComissao, data, descricao: descricao.trim() || undefined, valor: parsedValor, contaDestinoId, contaOrigemId };
    const attempt = transferenciaId ? null : prepareTransferIntent(payload, intent);
    if (!transferenciaId && !attempt) { setMessage('Resultado ainda nao confirmado. Confira o historico antes de alterar esta tentativa.'); return; }
    if (attempt) draft.setField('intent', attempt);
    const submitted = draft.capture();
    sending.current = true;
    try {
      setSaving(true);
      setMessage('');

      const updatePayload = {
        comissao: parsedComissao,
        data,
        descricao: descricao.trim() || undefined,
        valor: parsedValor,
      };

      if (transferenciaId) {
        await updateTransferencia(transferenciaId, updatePayload);
      } else {
        await createTransferencia({ ...attempt!.payload, idempotencyKey: attempt!.key });
      }

      if (!draft.isCurrent(submitted)) return;
      draft.clear(submitted);
      router.replace('/transferencias' as never);
    } catch (error) {
      if (!draft.isCurrent(submitted)) return;
      if (isUnknownTransferOutcome(error)) {
        setMessage('Resultado nao confirmado. Confira o historico ou tente confirmar a mesma transferencia.');
        return;
      }
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel salvar a transferencia.',
      );
      if (!draft.isCurrent(submitted)) return;
      if ((error as { response?: { status?: number } })?.response?.status !== 409) draft.setField('intent', null);
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      sending.current = false;
      if (draft.isCurrent()) setSaving(false);
    }
  }

  const contaOptions = contas.map((conta) => ({ label: conta.nome, value: conta.id }));

  return (
    <AppShell
      activeRoute="/transferencias"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => { if (!intent) draft.clear(); router.back(); }} variant="ghost" />}
          eyebrow="Movimentacoes"
          subtitle="Registre transferencias entre contas."
          title={transferenciaId ? 'Editar transferencia' : 'Nova transferencia'}
        />
      }
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando transferencia...</Text>
          </View>
        </GlassPanel>
      ) : (
        <GlassPanel>
          <GlassField label="Conta origem">
            <GlassOptionGroup
              disabled={Boolean(transferenciaId)}
              options={contaOptions}
              value={contaOrigemId}
              onChange={setContaOrigemId}
            />
          </GlassField>

          <GlassField label="Conta destino">
            <GlassOptionGroup
              disabled={Boolean(transferenciaId)}
              options={contaOptions}
              value={contaDestinoId}
              onChange={setContaDestinoId}
            />
          </GlassField>

          <GlassField label="Valor">
            <GlassTextInput
              accessibilityLabel="Valor da transferencia"
              keyboardType="decimal-pad"
              value={valor}
              onChangeText={setValor}
            />
          </GlassField>

          <GlassField label="Comissao">
            <GlassTextInput
              accessibilityLabel="Comissao da transferencia"
              keyboardType="decimal-pad"
              value={comissao}
              onChangeText={setComissao}
            />
          </GlassField>

          <GlassField label="Data">
            <GlassTextInput
              accessibilityLabel="Data da transferencia"
              value={data}
              onChangeText={setData}
            />
          </GlassField>

          <GlassField label="Descricao">
            <GlassTextInput
              accessibilityLabel="Descricao da transferencia"
              value={descricao}
              onChangeText={setDescricao}
            />
          </GlassField>

          {intent ? <>
            <Text style={styles.errorMessage}>Resultado ainda nao confirmado. Confira o historico antes de iniciar outra transferencia.</Text>
            <GlassButton label="Conferi o historico; iniciar outra transferencia" variant="ghost"
              disabled={saving} onPress={() => { draft.setField('intent', null); setMessage(''); }} />
          </> : null}
          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
          <GlassButton
            label={saving ? 'Salvando...' : 'Salvar transferencia'}
            onPress={handleSave}
            disabled={saving}
          />
        </GlassPanel>
      )}
    </AppShell>
  );
}

export default TransferenciaFormScreen;

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
