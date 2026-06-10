import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { listCategorias } from '../../categorias/services/categoriaService';
import { Categoria } from '../../categorias/types/categoria';
import { listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassOptionGroup,
  GlassPanel,
  GlassStatusCard,
  GlassTextInput,
} from '../../../shared/ui';
import { confirmAction } from '../../../../utils/confirm-action';
import { resolveApiError } from '../../../../utils/api-error';
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import { parseDecimalInput } from '../../../../utils/number-input';
import {
  createPagoDivida,
  listPagosByDivida,
  removePagoDivida,
} from '../services/pagoDividaService';
import { PagoDivida } from '../types/pago-divida';

export function PagosDividaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dividaId?: string | string[] }>();
  const dividaId = Array.isArray(params.dividaId) ? params.dividaId[0] : params.dividaId;
  const [pagos, setPagos] = useState<PagoDivida[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contaId, setContaId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const categoriasDespesa = useMemo(
    () => categorias.filter((categoria) => categoria.tipo === 'despesa'),
    [categorias],
  );

  const loadPayments = useCallback(async () => {
    if (!dividaId) {
      setMessage('Divida invalida.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      const [pagosData, contasData, categoriasData] = await Promise.all([
        listPagosByDivida(dividaId),
        listContas(),
        listCategorias('despesa'),
      ]);
      setPagos(pagosData);
      setContas(contasData);
      setCategorias(categoriasData);
      setContaId((current) => current || contasData[0]?.id || '');
      setCategoriaId((current) => current || categoriasData[0]?.id || '');
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar pagamentos.');
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
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
    const parsedValor = parseDecimalInput(valor);

    if (!dividaId || !contaId || !categoriaId || !Number.isFinite(parsedValor)) {
      setMessage('Preencha conta, categoria, valor e data.');
      return;
    }

    if (parsedValor <= 0) {
      setMessage('O valor deve ser maior que zero.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      await createPagoDivida({
        categoriaId,
        contaId,
        data,
        descricao: descricao.trim() || undefined,
        dividaId,
        valor: parsedValor,
      });
      setValor('');
      setDescricao('');
      await reloadPayments();
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel registrar o pagamento.');
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setSaving(false);
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
    <FinanceAppShell
      activeRoute="/dividas"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => router.replace('/dividas' as never)} variant="ghost" />}
          eyebrow="Compromissos"
          subtitle="Registre pagamentos e acompanhe o historico da divida."
          title="Pagamentos da divida"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {loading ? (
        <GlassStatusCard
          title="Carregando pagamentos"
          description="Estamos buscando pagamentos, contas e categorias."
          loading
        />
      ) : (
        <>
          <GlassPanel>
            <GlassField label="Conta">
              <GlassOptionGroup
                options={contas.map((conta) => ({ label: conta.nome, value: conta.id }))}
                value={contaId}
                onChange={setContaId}
              />
            </GlassField>

            <GlassField label="Categoria">
              <GlassOptionGroup
                options={categoriasDespesa.map((categoria) => ({
                  label: categoria.nome,
                  value: categoria.id,
                }))}
                value={categoriaId}
                onChange={setCategoriaId}
              />
            </GlassField>

            <GlassField label="Valor">
              <GlassTextInput
                keyboardType="decimal-pad"
                value={valor}
                onChangeText={setValor}
              />
            </GlassField>

            <GlassField label="Data">
              <GlassTextInput value={data} onChangeText={setData} />
            </GlassField>

            <GlassField label="Descricao">
              <GlassTextInput value={descricao} onChangeText={setDescricao} />
            </GlassField>

            {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
            <GlassButton
              label={saving ? 'Salvando...' : 'Registrar pagamento'}
              onPress={handleSave}
              disabled={saving}
            />
          </GlassPanel>

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
    </FinanceAppShell>
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
