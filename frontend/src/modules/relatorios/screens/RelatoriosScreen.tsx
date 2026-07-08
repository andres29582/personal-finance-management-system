import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { resolveApiError } from '../../../../utils/api-error';
import {
  formatCurrency,
  formatDate,
  getCurrentMonthReference,
} from '../../../../utils/formatters';
import { RelatorioGestaoCharts } from '../components/RelatorioGestaoCharts';
import { getRelatorio } from '../services/relatorioService';
import { PeriodoRelatorio, RelatorioResponse } from '../types/relatorio';
import { buildRelatorioParams } from '../utils/relatorioFilters';

export function RelatoriosScreen() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>('mensal');
  const [mes, setMes] = useState(getCurrentMonthReference());
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [trimestre, setTrimestre] = useState('1');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipo, setTipo] = useState('');
  const [contaId, setContaId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const primeiraCargaRef = useRef(false);

  useEffect(() => {
    async function loadSelectors() {
      try {
        const [categoriasData, contasData] = await Promise.all([
          listCategorias(),
          listContas(),
        ]);
        setCategorias(categoriasData);
        setContas(contasData);
      } catch (error) {
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar filtros do relatorio.',
        );
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      }
    }

    void loadSelectors();
  }, [router]);

  const filtros = useMemo(
    () =>
      buildRelatorioParams({
        ano,
        categoriaId,
        contaId,
        dataFim,
        dataInicio,
        mes,
        periodo,
        tipo,
        trimestre,
      }),
    [ano, categoriaId, contaId, dataFim, dataInicio, mes, periodo, tipo, trimestre],
  );

  const handleGenerate = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const data = await getRelatorio(filtros);
      setRelatorio(data);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel gerar o relatorio.',
      );
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [filtros, router]);

  useEffect(() => {
    if (primeiraCargaRef.current) {
      return;
    }

    primeiraCargaRef.current = true;
    void handleGenerate();
  }, [handleGenerate]);

  return (
    <FinanceAppShell
      activeRoute="/relatorios"
      header={
        <FinanceAppHeader
          eyebrow="Analise financeira"
          subtitle="Analise receitas, despesas e economia."
          title="Relatorios"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassField label="Periodo">
          <GlassOptionGroup
            options={[
              { label: 'Mensal', value: 'mensal' },
              { label: 'Trimestral', value: 'trimestral' },
              { label: 'Intervalo', value: 'intervalo' },
            ]}
            value={periodo}
            onChange={(value) => setPeriodo(value as PeriodoRelatorio)}
          />
        </GlassField>

        {periodo === 'mensal' ? (
          <GlassField label="Mes (YYYY-MM)">
            <GlassTextInput
              placeholder="2026-04"
              value={mes}
              onChangeText={setMes}
            />
          </GlassField>
        ) : null}

        {periodo === 'trimestral' ? (
          <>
            <GlassField label="Ano">
              <GlassTextInput
                keyboardType="number-pad"
                placeholder="2026"
                value={ano}
                onChangeText={setAno}
              />
            </GlassField>
            <GlassField label="Trimestre">
              <GlassTextInput
                keyboardType="number-pad"
                placeholder="1"
                value={trimestre}
                onChangeText={setTrimestre}
              />
            </GlassField>
          </>
        ) : null}

        {periodo === 'intervalo' ? (
          <>
            <GlassField label="Data inicial">
              <GlassTextInput
                placeholder="2026-04-01"
                value={dataInicio}
                onChangeText={setDataInicio}
              />
            </GlassField>
            <GlassField label="Data final">
              <GlassTextInput
                placeholder="2026-04-30"
                value={dataFim}
                onChangeText={setDataFim}
              />
            </GlassField>
          </>
        ) : null}

        <GlassField label="Tipo">
          <GlassOptionGroup
            options={[
              { label: 'Todos', value: '' },
              { label: 'Receitas', value: 'receita' },
              { label: 'Despesas', value: 'despesa' },
            ]}
            value={tipo}
            onChange={setTipo}
          />
        </GlassField>

        <GlassField label="Conta">
          <GlassOptionGroup
            options={[
              { label: 'Todas', value: '' },
              ...contas.map((conta) => ({ label: conta.nome, value: conta.id })),
            ]}
            value={contaId}
            onChange={setContaId}
          />
        </GlassField>

        <GlassField label="Categoria">
          <GlassOptionGroup
            options={[
              { label: 'Todas', value: '' },
              ...categorias.map((categoria) => ({
                label: categoria.nome,
                value: categoria.id,
              })),
            ]}
            value={categoriaId}
            onChange={setCategoriaId}
          />
        </GlassField>

        <GlassButton
          label={loading ? 'Gerando...' : 'Gerar relatorio'}
          onPress={handleGenerate}
          variant="ghost"
          disabled={loading}
        />
      </GlassPanel>

      {message && relatorio ? <Text style={styles.errorMessage}>{message}</Text> : null}

      {loading && !relatorio ? (
        <GlassStatusCard
          title="Carregando relatorio"
          description="Estamos reunindo os dados para o periodo selecionado."
          loading
        />
      ) : null}

      {!loading && !!message && !relatorio ? (
        <GlassStatusCard
          title="Nao foi possivel gerar o relatorio"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={handleGenerate}
        />
      ) : null}

      {!loading && relatorio ? (
        <>
          <View style={styles.summaryGrid}>
            <GlassPanel accent="mixed" style={styles.metricCard}>
              <Text style={styles.metricLabel}>Periodo</Text>
              <Text style={styles.metricValue}>{relatorio.periodoReferencia}</Text>
            </GlassPanel>
            <GlassPanel accent="cyan" style={styles.metricCard}>
              <Text style={styles.metricLabel}>Receitas</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(relatorio.resumo.totalReceitas)}
              </Text>
            </GlassPanel>
            <GlassPanel accent="magenta" style={styles.metricCard}>
              <Text style={styles.metricLabel}>Despesas</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(relatorio.resumo.totalDespesas)}
              </Text>
            </GlassPanel>
            <GlassPanel accent="cyan" style={styles.metricCard}>
              <Text style={styles.metricLabel}>Economia</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(relatorio.resumo.economia)}
              </Text>
            </GlassPanel>
          </View>

          <GlassPanel>
            <RelatorioGestaoCharts
              despesasPorCategoria={relatorio.despesasPorCategoria}
              totalDespesas={relatorio.resumo.totalDespesas}
              totalReceitas={relatorio.resumo.totalReceitas}
            />
          </GlassPanel>

          <GlassPanel>
            <Text style={styles.sectionTitle}>Despesas por categoria</Text>
            {relatorio.despesasPorCategoria.length ? (
              relatorio.despesasPorCategoria.map((item) => (
                <View key={item.categoriaId} style={styles.rowItem}>
                  <Text style={styles.rowText}>
                    {item.categoriaNome}: {formatCurrency(item.total)} ({item.percentual}%)
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Sem despesas para o filtro atual.</Text>
            )}
          </GlassPanel>

          <GlassPanel>
            <Text style={styles.sectionTitle}>Transacoes</Text>
            {relatorio.transacoes.length ? (
              relatorio.transacoes.map((item) => (
                <View key={item.id} style={styles.transactionItem}>
                  <Text style={styles.transactionTitle}>
                    {item.descricao || item.categoriaNome}
                  </Text>
                  <Text style={styles.transactionMeta}>
                    {item.contaNome} - {formatDate(item.data)} - {item.tipo}
                  </Text>
                  <Text style={styles.transactionValue}>{formatCurrency(item.valor)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhuma transacao encontrada.</Text>
            )}
          </GlassPanel>
        </>
      ) : null}
    </FinanceAppShell>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.body,
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  metricCard: {
    flex: 1,
    minWidth: 190,
  },
  metricLabel: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  metricValue: {
    color: FinanceTheme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: FinanceTheme.spacing.xs,
  },
  rowItem: {
    marginTop: FinanceTheme.spacing.sm,
  },
  rowText: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
  },
  sectionTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.md,
  },
  transactionItem: {
    borderBottomColor: FinanceTheme.colors.border,
    borderBottomWidth: FinanceTheme.borderWidth.hairline,
    paddingVertical: FinanceTheme.spacing.sm,
  },
  transactionMeta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  transactionTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
  },
  transactionValue: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
    marginTop: FinanceTheme.spacing.xs,
  },
});

export default RelatoriosScreen;
