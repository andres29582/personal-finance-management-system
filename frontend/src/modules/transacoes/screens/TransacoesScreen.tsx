import { createHistoryRequestFence } from '../../../shared/hooks/historyRequestFence';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { getCategoriaById, listCategorias } from '../../categorias/services/categoriaService';
import { Categoria } from '../../categorias/types/categoria';
import { getContaById, listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import { listTransacoes, removeTransacao } from '../services/transacaoService';
import { TipoTransacao, Transacao } from '../types/transacao';
import { resolveApiError } from '../../../../utils/api-error';
import { confirmAction } from '../../../../utils/confirm-action';
import {
  formatCurrency,
  formatDate,
  getCurrentMonthReference,
  getLocalDateInputValue,
} from '../../../../utils/formatters';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function getDateHeading(date: string) {
  const today = getLocalDateInputValue();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date === today) return 'Hoje';
  if (date === getLocalDateInputValue(yesterday)) return 'Ontem';
  return formatDate(date);
}

export function TransacoesScreen() {
  const router = useRouter();
  const [requests] = useState(createHistoryRequestFence);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [mes, setMes] = useState(getCurrentMonthReference());
  const [appliedFilters, setAppliedFilters] = useState({
    mes: getCurrentMonthReference(),
    tipo: '',
    offset: 0,
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTransacao, setSelectedTransacao] = useState<Transacao | null>(null);

  const categoriaMap = useMemo(
    () => new Map(categorias.map((categoria) => [categoria.id, categoria])),
    [categorias],
  );
  const contaMap = useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta])),
    [contas],
  );
  const transacoesPorData = useMemo(() => {
    const groups = new Map<string, Transacao[]>();
    transacoes.forEach((transacao) => {
      const group = groups.get(transacao.data) ?? [];
      group.push(transacao);
      groups.set(transacao.data, group);
    });
    return [...groups.entries()];
  }, [transacoes]);

  const loadData = useCallback(async () => {
    const request = requests.start();
    if (!requests.current(request)) return;
    try {
      setLoading(true);
      setMessage('');
      const [contasData, categoriasData, transacoesData] = await Promise.all([
        listContas(),
        listCategorias(),
        listTransacoes({
          limit: 50, offset: appliedFilters.offset,
          mes: appliedFilters.mes,
          tipo: appliedFilters.tipo ? (appliedFilters.tipo as TipoTransacao) : undefined,
        }),
      ]);
      if (!requests.current(request)) return;
      if (!transacoesData.length && appliedFilters.offset > 0) {
        setTransacoes([]);
        requests.invalidate();
        setAppliedFilters(filters => ({...filters, offset: Math.max(0, filters.offset - 50)}));
        return;
      }
      const contaIds = [...new Set(
        transacoesData
          .map(({ contaId }) => contaId)
          .filter((id) => !contasData.some((conta) => conta.id === id)),
      )];
      const categoriaIds = [...new Set(
        transacoesData
          .map(({ categoriaId }) => categoriaId)
          .filter((id) => !categoriasData.some((categoria) => categoria.id === id)),
      )];
      const [contasHistoricas, categoriasHistoricas] = await Promise.all([
        Promise.all(contaIds.map((id) => getContaById(id))),
        Promise.all(categoriaIds.map((id) => getCategoriaById(id))),
      ]);

      if (!requests.current(request)) return;
      setContas([...contasData, ...contasHistoricas]);
      setCategorias([...categoriasData, ...categoriasHistoricas]);
      setTransacoes(transacoesData);
    } catch (error) {
      if (!requests.current(request)) return;
      const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar as transacoes.');
      if (!requests.current(request)) return;
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) router.replace('/login');
    } finally {
      if (requests.current(request)) setLoading(false);
    }
  }, [appliedFilters, router, requests]);

  useFocusEffect(useCallback(() => { requests.focus(); void loadData(); return () => requests.blur(); }, [loadData, requests]));

  async function handleRemove(id: string) {
    const request = requests.capture();
    const confirmed = await confirmAction('Excluir transacao', 'Deseja remover esta transacao?');
    if (!requests.current(request) || !confirmed) return false;

    try {
      await removeTransacao(id);
      if (!requests.current(request)) return false;
      setSelectedTransacao(null);
      await loadData();
      return true;
    } catch (error) {
      if (!requests.current(request)) return;
      const resolvedError = await resolveApiError(error, 'Nao foi possivel excluir a transacao.');
      if (!requests.current(request)) return false;
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) router.replace('/login');
      return false;
    }
  }

  function applyMonthIfValid() {
    if (monthPattern.test(mes) && mes !== appliedFilters.mes) {
      requests.invalidate();
      setTransacoes([]);
      setSelectedTransacao(null);
      setAppliedFilters((filters) => ({ ...filters, mes, offset: 0 }));
    }
  }

  function handleTipoChange(nextTipo: string) {
    requests.invalidate();
    setTransacoes([]);
    setSelectedTransacao(null);
    setAppliedFilters((filters) => ({ ...filters, tipo: nextTipo, offset: 0 }));
  }

  function navigateToEdit(id: string) {
    setSelectedTransacao(null);
    router.push({ pathname: '/transacoes-form', params: { id } } as never);
  }

  return (
    <AppShell
      activeRoute="/transacoes"
      onProfilePress={() => router.push('/usuario' as never)}
      onRefresh={loadData}
      refreshing={loading && transacoes.length > 0}
      pageHeader={
        <FinanceAppHeader
          eyebrow="Movimentacoes"
          subtitle="Registre receitas e despesas."
          title="Transacoes"
        />
      }
    >
      <GlassPanel style={styles.filterPanel} title="Filtrar transacoes">
        <GlassField label="Mes (YYYY-MM)">
          <GlassTextInput
            accessibilityLabel="Mes das transacoes"
            keyboardType="numbers-and-punctuation"
            maxLength={7}
            onBlur={applyMonthIfValid}
            onChangeText={setMes}
            placeholder="2026-04"
            returnKeyType="done"
            value={mes}
          />
        </GlassField>
        <GlassField label="Tipo">
          <GlassOptionGroup
            options={[
              { label: 'Todos', value: '' },
              { label: 'Receitas', value: 'receita' },
              { label: 'Despesas', value: 'despesa' },
            ]}
            value={appliedFilters.tipo}
            onChange={handleTipoChange}
          />
        </GlassField>
        {!monthPattern.test(mes) ? (
          <Text style={styles.filterHint}>Informe o mes no formato YYYY-MM.</Text>
        ) : null}
      </GlassPanel>

      {message && transacoes.length ? <Text style={styles.errorMessage}>{message}</Text> : null}

      {loading && !transacoes.length ? (
        <GlassStatusCard title="Carregando transacoes" description="Estamos buscando as transacoes do periodo selecionado." loading />
      ) : null}
      {!loading && !!message && !transacoes.length ? (
        <GlassStatusCard title="Nao foi possivel carregar as transacoes" description={message} tone="error" actionLabel="Tentar novamente" onActionPress={loadData} />
      ) : null}
      {!loading && !message && !transacoes.length ? (
        <GlassStatusCard title="Nenhuma transacao encontrada" description="Registre uma receita ou despesa para preencher o historico." actionLabel="Nova transacao" onActionPress={() => router.push('/transacoes-form' as never)} />
      ) : null}

      {!loading && transacoesPorData.map(([data, transacoesDoDia]) => (
        <View key={data} style={styles.dateGroup}>
          <Text style={styles.dateHeading}>{getDateHeading(data)}</Text>
          <View style={styles.transactionList}>
            {transacoesDoDia.map((transacao) => {
              const isIncome = transacao.tipo === 'receita';
              const categoria = categoriaMap.get(transacao.categoriaId)?.nome || 'Categoria';
              const conta = contaMap.get(transacao.contaId)?.nome || '-';
              return (
                <Pressable
                  key={transacao.id}
                  accessibilityHint="Abre as opcoes desta transacao"
                  accessibilityLabel={`${isIncome ? 'Receita' : 'Despesa'}: ${transacao.descricao || categoria}, ${formatCurrency(Math.abs(transacao.valor))}`}
                  accessibilityRole="button"
                  onPress={() => setSelectedTransacao(transacao)}
                  style={({ pressed }) => [styles.transactionRow, pressed ? styles.rowPressed : null]}
                >
                  <View style={[styles.transactionIcon, isIncome ? styles.incomeIcon : styles.expenseIcon]}>
                    <MaterialCommunityIcons color={isIncome ? FinanceTheme.colors.success : FinanceTheme.colors.danger} name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={20} />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text numberOfLines={1} style={styles.transactionTitle}>{transacao.descricao || categoria}</Text>
                    <Text numberOfLines={1} style={styles.transactionMeta}>{conta} - {categoria}</Text>
                  </View>
                  <View style={styles.amountGroup}>
                    <Text style={[styles.transactionAmount, isIncome ? styles.incomeAmount : styles.expenseAmount]}>
                      {isIncome ? '+' : '-'} {formatCurrency(Math.abs(transacao.valor))}
                    </Text>
                    <Text style={styles.typeLabel}>{isIncome ? 'Receita' : 'Despesa'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View style={styles.actions}>
        <GlassButton label="Pagina anterior" variant="ghost" disabled={loading || appliedFilters.offset === 0}
          onPress={() => { requests.invalidate(); setTransacoes([]); setSelectedTransacao(null); setAppliedFilters(filters => ({...filters, offset: Math.max(0, filters.offset - 50)})); }} />
        <Text accessibilityLiveRegion="polite" style={styles.filterHint}>Pagina {appliedFilters.offset / 50 + 1}</Text>
        <GlassButton label="Proxima pagina" variant="ghost" disabled={loading || transacoes.length < 50}
          onPress={() => { requests.invalidate(); setTransacoes([]); setSelectedTransacao(null); setAppliedFilters(filters => ({...filters, offset: filters.offset + 50})); }} />
      </View>
      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedTransacao(null)}
        transparent
        visible={Boolean(selectedTransacao)}
      >
        <Pressable accessibilityLabel="Fechar opcoes da transacao" onPress={() => setSelectedTransacao(null)} style={styles.modalBackdrop}>
          <Pressable onPress={() => undefined} style={styles.bottomSheet}>
            {selectedTransacao ? (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>{selectedTransacao.descricao || categoriaMap.get(selectedTransacao.categoriaId)?.nome || 'Transacao'}</Text>
                <Text style={styles.sheetMeta}>{formatDate(selectedTransacao.data)} - {contaMap.get(selectedTransacao.contaId)?.nome || '-'}</Text>
                <Text style={[styles.sheetAmount, selectedTransacao.tipo === 'receita' ? styles.incomeAmount : styles.expenseAmount]}>
                  {selectedTransacao.tipo === 'receita' ? '+' : '-'} {formatCurrency(Math.abs(selectedTransacao.valor))}
                </Text>
                <View style={styles.sheetActions}>
                  <GlassButton label="Editar" variant="ghost" onPress={() => navigateToEdit(selectedTransacao.id)} />
                  <GlassButton label="Excluir" variant="danger" onPress={() => handleRemove(selectedTransacao.id)} />
                  <GlassButton label="Fechar" variant="ghost" onPress={() => setSelectedTransacao(null)} />
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </AppShell>
  );
}

export default TransacoesScreen;

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: FinanceTheme.spacing.sm },
  amountGroup: { alignItems: 'flex-end', gap: 2 },
  bottomSheet: {
    backgroundColor: FinanceTheme.colors.backgroundElevated,
    borderColor: FinanceTheme.colors.phthaloBorder,
    borderTopLeftRadius: FinanceTheme.radius.xl,
    borderTopRightRadius: FinanceTheme.radius.xl,
    borderWidth: FinanceTheme.borderWidth.hairline,
    padding: FinanceTheme.spacing.lg,
    width: '100%',
  },
  dateGroup: { marginBottom: FinanceTheme.spacing.md },
  dateHeading: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.xs,
    textTransform: 'uppercase',
  },
  errorMessage: { color: FinanceTheme.colors.danger, fontSize: FinanceTheme.typography.caption, fontWeight: '700', marginBottom: FinanceTheme.spacing.sm, textAlign: 'center' },
  expenseAmount: { color: FinanceTheme.colors.danger },
  expenseIcon: { backgroundColor: 'rgba(255, 122, 144, 0.12)' },
  filterHint: { color: FinanceTheme.colors.warning, fontSize: FinanceTheme.typography.caption, fontWeight: '700', marginTop: FinanceTheme.spacing.xxs },
  filterPanel: { marginBottom: FinanceTheme.spacing.md },
  incomeAmount: { color: FinanceTheme.colors.success },
  incomeIcon: { backgroundColor: 'rgba(119, 242, 178, 0.12)' },
  modalBackdrop: { backgroundColor: 'rgba(2, 13, 16, 0.76)', flex: 1, justifyContent: 'flex-end' },
  rowPressed: { opacity: FinanceTheme.opacity.pressed },
  sheetActions: { gap: FinanceTheme.spacing.sm, marginTop: FinanceTheme.spacing.lg },
  sheetAmount: { fontSize: 24, fontWeight: '900', marginTop: FinanceTheme.spacing.md },
  sheetHandle: { alignSelf: 'center', backgroundColor: FinanceTheme.colors.borderStrong, borderRadius: 999, height: 4, marginBottom: FinanceTheme.spacing.md, width: 42 },
  sheetMeta: { color: FinanceTheme.colors.textMuted, fontSize: FinanceTheme.typography.caption, marginTop: FinanceTheme.spacing.xxs },
  sheetTitle: { color: FinanceTheme.colors.text, fontSize: FinanceTheme.typography.heading, fontWeight: '900' },
  transactionAmount: { fontSize: FinanceTheme.typography.body, fontWeight: '900' },
  transactionIcon: { alignItems: 'center', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  transactionInfo: { flex: 1, minWidth: 0 },
  transactionList: { backgroundColor: FinanceTheme.colors.glass, borderColor: FinanceTheme.colors.border, borderRadius: FinanceTheme.radius.lg, borderWidth: FinanceTheme.borderWidth.hairline, overflow: 'hidden' },
  transactionMeta: { color: FinanceTheme.colors.textMuted, fontSize: FinanceTheme.typography.caption, marginTop: 2 },
  transactionRow: { alignItems: 'center', borderBottomColor: FinanceTheme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: FinanceTheme.spacing.sm, minHeight: 72, paddingHorizontal: FinanceTheme.spacing.sm, paddingVertical: FinanceTheme.spacing.sm },
  transactionTitle: { color: FinanceTheme.colors.text, fontSize: FinanceTheme.typography.body, fontWeight: '800' },
  typeLabel: { color: FinanceTheme.colors.textSubtle, fontSize: FinanceTheme.typography.micro, fontWeight: '700' },
});
