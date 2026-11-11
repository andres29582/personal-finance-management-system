import { useFinancialDraft } from '../../../shared/hooks/useFinancialDraft';
import type { PaymentFieldErrors } from '../validators/pagoDividaForm';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { listCategorias } from '../../categorias/services/categoriaService';
import { Categoria } from '../../categorias/types/categoria';
import { listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import { getDividaById } from '../../dividas/services/dividaService';
import { Divida } from '../../dividas/types/divida';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  AppShell,
  FinanceAppHeader,
  GlassButton,
  GlassField,
  GlassOptionGroup,
  GlassPanel,
  GlassStatusCard,
  GlassTextInput,
} from '../../../shared/ui';
import { confirmAction } from '../../../../utils/confirm-action';
import { resolveApiError } from '../../../../utils/api-error';
import {
  formatCurrency,
  formatDate,
  getLocalDateInputValue,
} from '../../../../utils/formatters';
import { buildPagoDividaPayload } from '../mappers/pagoDividaPayloadMapper';
import {
  createPagoDivida,
  listPagosByDivida,
  removePagoDivida,
} from '../services/pagoDividaService';
import { PagoDivida } from '../types/pago-divida';
import { validatePagoDividaForm } from '../validators/pagoDividaForm';

export function PagosDividaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dividaId?: string | string[] }>();
  const dividaId = Array.isArray(params.dividaId) ? params.dividaId[0] : params.dividaId;
  const [divida, setDivida] = useState<Divida | null>(null);
  const [pagos, setPagos] = useState<PagoDivida[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const draft = useFinancialDraft('payment/' + (dividaId ?? 'missing'), {
    contaId: '',
    categoriaId: '',
    valor: '',
    data: getLocalDateInputValue(),
    descricao: '',
  });
  const contaId = draft.fields.contaId;
  const setContaId = (value: string) => draft.setField('contaId', value);
  const categoriaId = draft.fields.categoriaId;
  const setCategoriaId = (value: string) =>
    draft.setField('categoriaId', value);
  const valor = draft.fields.valor;
  const setValor = (value: string) => draft.setField('valor', value);
  const data = draft.fields.data;
  const setData = (value: string) => draft.setField('data', value);
  const descricao = draft.fields.descricao;
  const setDescricao = (value: string) => draft.setField('descricao', value);





  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<PaymentFieldErrors>({});

  const categoriasDespesa = useMemo(
    () => categorias.filter((categoria) => categoria.tipo === 'despesa'),
    [categorias],
  );
  const paymentBlocked = divida?.ativa === false;

  const loadPayments = useCallback(async () => {
    const loadScope = draft.capture();
    if (!draft.isCurrent(loadScope)) return;
    if (!dividaId) {
      setMessage('Divida invalida.');
      if (draft.isCurrent()) setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      const [dividaData, pagosData, contasData, categoriasData] = await Promise.all([
        getDividaById(dividaId),
        listPagosByDivida(dividaId),
        listContas(),
        listCategorias('despesa'),
      ]);
      if (!draft.isCurrent(loadScope)) return;
      setDivida(dividaData);
      setPagos(pagosData);
      setContas(contasData);
      setCategorias(categoriasData);
      draft.hydrate({ contaId: contasData[0]?.id || '', categoriaId: categoriasData[0]?.id || '' });
    } catch (error) {
        if (!draft.isCurrent(loadScope)) return;
      const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar pagamentos.');
      if (!draft.isCurrent(loadScope)) return;
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (draft.isCurrent()) setLoading(false);
    }
  }, [dividaId, router]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  async function reloadPayments() {
    if (!dividaId) {
      return;
    }

    setPagos(await listPagosByDivida(dividaId));
  }

  async function handleSave() {
    const submitted = draft.capture();
    if (!draft.isCurrent(submitted)) return;
    const formValues = {
      categoriaId,
      contaId,
      data,
      descricao,
      dividaId,
      valor,
    };

    if (paymentBlocked) {
      setMessage('Nao e possivel registrar pagamento para uma divida inativa.');
      return;
    }

    const validation = validatePagoDividaForm(formValues);

    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      setMessage(validation.message);
      return;
    }

    try {
      setFieldErrors({});
      setSaving(true);
      setMessage('');
      await createPagoDivida(
        buildPagoDividaPayload(formValues, validation.parsedValor),
      );
      if (!draft.isCurrent(submitted)) return;
      setValor('');
      setDescricao('');
      draft.clear();
      const completed = draft.capture();
      const updatedPayments = await listPagosByDivida(dividaId!);
      if (!draft.isCurrent(completed)) return;
      setPagos(updatedPayments);
    } catch (error) {
      if (!draft.isCurrent(submitted)) return;
      const resolvedError = await resolveApiError(error, 'Nao foi possivel registrar o pagamento.');
      if (!draft.isCurrent(submitted)) return;
      setMessage(resolvePaymentErrorMessage(resolvedError));
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (draft.isCurrent()) setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    const confirmed = await confirmAction(
      'Excluir pagamento',
      'Deseja remover este pagamento?',
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage('');
      await removePagoDivida(id);
      await reloadPayments();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel remover o pagamento.',
      );
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    }
  }

  return (
    <AppShell
      activeRoute="/dividas"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => { draft.clear(); router.replace('/dividas' as never); }} variant="ghost" />}
          eyebrow="Compromissos"
          subtitle="Registre pagamentos e acompanhe o historico da divida."
          title="Pagamentos da divida"
        />
      }
    >
      {loading ? (
        <GlassStatusCard
          title="Carregando pagamentos"
          description="Estamos buscando pagamentos, contas e categorias."
          loading
        />
      ) : (
        <>
          {paymentBlocked ? (
            <GlassStatusCard
              title="Divida inativa"
              description="Nao e possivel registrar pagamento para uma divida inativa."
              tone="error"
            />
          ) : (
            <GlassPanel>
              <GlassField label="Conta" error={fieldErrors.contaId}>
                <GlassOptionGroup
                  options={contas.map((conta) => ({ label: conta.nome, value: conta.id }))}
                  value={contaId}
                  onChange={setContaId}
                />
              </GlassField>

              <GlassField label="Categoria" error={fieldErrors.categoriaId}>
                <GlassOptionGroup
                  options={categoriasDespesa.map((categoria) => ({
                    label: categoria.nome,
                    value: categoria.id,
                  }))}
                  value={categoriaId}
                  onChange={setCategoriaId}
                />
              </GlassField>

              <GlassField label="Valor" error={fieldErrors.valor}>
                <GlassTextInput
                  accessibilityLabel="Valor do pagamento"
                  accessibilityHint={fieldErrors.valor}
                  keyboardType="decimal-pad"
                  value={valor}
                  onChangeText={(value) => { setValor(value); setFieldErrors(errors => ({...errors, valor: undefined})); }}
                />
              </GlassField>

              <GlassField label="Data" error={fieldErrors.data}>
                <GlassTextInput accessibilityLabel="Data do pagamento" accessibilityHint={fieldErrors.data} value={data} onChangeText={(value) => { setData(value); setFieldErrors(errors => ({...errors, data: undefined})); }} />
              </GlassField>

              <GlassField label="Descricao">
                <GlassTextInput accessibilityLabel="Descricao do pagamento" value={descricao} onChangeText={setDescricao} />
              </GlassField>

              {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorMessage}>{message}</Text> : null}
              <GlassButton
                label={saving ? 'Salvando...' : 'Registrar pagamento'}
                onPress={handleSave}
                disabled={saving}
              />
            </GlassPanel>
          )}

          {pagos.length ? (
            pagos.map((pago) => (
              <GlassPanel key={pago.id} accent="magenta">
                <Text style={styles.title}>{pago.descricao || 'Pagamento de divida'}</Text>
                <Text style={styles.meta}>{formatDate(pago.data)}</Text>
                <Text style={styles.value}>{formatCurrency(pago.valor)}</Text>
                <View style={styles.actions}>
                  <GlassButton
                    label="Excluir"
                    variant="danger"
                    onPress={() => handleRemove(pago.id)}
                  />
                </View>
              </GlassPanel>
            ))
          ) : (
            <GlassStatusCard
              title="Nenhum pagamento registrado"
              description="Registre o primeiro pagamento para acompanhar a baixa da divida."
            />
          )}
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: FinanceTheme.spacing.md,
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  meta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
  },
  value: {
    color: FinanceTheme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: FinanceTheme.spacing.sm,
  },
});

export default PagosDividaScreen;

type ResolvedApiError = Awaited<ReturnType<typeof resolveApiError>>;

function resolvePaymentErrorMessage(resolvedError: ResolvedApiError) {
  if (resolvedError.code === 'PAGAMENTO_DIVIDA_INACTIVE_DEBT') {
    return 'Nao e possivel registrar pagamento para uma divida inativa.';
  }

  return resolvedError.message;
}
