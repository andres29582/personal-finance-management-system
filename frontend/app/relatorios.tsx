import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppMessage } from '../components/app-message';
import { AppOptionGroup } from '../components/app-option-group';
import {
  AppCard,
  AppField,
  AppScreen,
  AppStatusCard,
  appInputStyles,
} from '../components/app-screen';
import { ContaTheme } from '../constants/contas-theme';
import { listCategorias } from '../services/categoriaService';
import { listContas } from '../services/contaService';
import { getRelatorio } from '../services/relatorioService';
import { Categoria } from '../types/categoria';
import { Conta } from '../types/conta';
import { GetRelatorioParams, PeriodoRelatorio, RelatorioResponse } from '../types/relatorio';
import { resolveApiError } from '../utils/api-error';
import { formatCurrency, formatDate, getCurrentMonthReference } from '../utils/formatters';

export default function RelatoriosScreen() {
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
      }
    }

    loadSelectors();
  }, []);

  const filtros = useMemo<GetRelatorioParams>(() => {
    const base: GetRelatorioParams = { periodo };

    if (periodo === 'mensal') {
      base.mes = mes;
    }

    if (periodo === 'trimestral') {
      base.ano = ano;
      base.trimestre = trimestre;
    }

    if (periodo === 'intervalo') {
      base.dataInicio = dataInicio;
      base.dataFim = dataFim;
    }

    if (tipo) {
      base.tipo = tipo as GetRelatorioParams['tipo'];
    }

    if (contaId) {
      base.contaId = contaId;
    }

    if (categoriaId) {
      base.categoriaId = categoriaId;
    }

    return base;
  }, [ano, categoriaId, contaId, dataFim, dataInicio, mes, periodo, tipo, trimestre]);

  async function handleGenerate() {
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    handleGenerate();
  }, []);

  return (
    <AppScreen
      title="Relatorios"
      subtitle="Analise receitas, despesas e economia."
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard' as never)}
    >
      <AppCard>
        <AppField label="Periodo">
          <AppOptionGroup
            options={[
              { label: 'Mensal', value: 'mensal' },
              { label: 'Trimestral', value: 'trimestral' },
              { label: 'Intervalo', value: 'intervalo' },
            ]}
            selectedValue={periodo}
            onChange={(value) => setPeriodo(value as PeriodoRelatorio)}
          />
        </AppField>

        {periodo === 'mensal' ? (
          <AppField label="Mes (YYYY-MM)">
            <TextInput
              style={appInputStyles.input}
              value={mes}
              onChangeText={setMes}
              placeholder="2026-04"
              placeholderTextColor="#8A8A8A"
            />
          </AppField>
        ) : null}

        {periodo === 'trimestral' ? (
          <>
            <AppField label="Ano">
              <TextInput
                style={appInputStyles.input}
                value={ano}
                onChangeText={setAno}
                placeholder="2026"
                placeholderTextColor="#8A8A8A"
              />
            </AppField>
            <AppField label="Trimestre">
              <TextInput
                style={appInputStyles.input}
                value={trimestre}
                onChangeText={setTrimestre}
                placeholder="1"
                placeholderTextColor="#8A8A8A"
              />
            </AppField>
          </>
        ) : null}

        {periodo === 'intervalo' ? (
          <>
            <AppField label="Data inicial">
              <TextInput
                style={appInputStyles.input}
                value={dataInicio}
                onChangeText={setDataInicio}
                placeholder="2026-04-01"
                placeholderTextColor="#8A8A8A"
              />
            </AppField>
            <AppField label="Data final">
              <TextInput
                style={appInputStyles.input}
                value={dataFim}
                onChangeText={setDataFim}
                placeholder="2026-04-30"
                placeholderTextColor="#8A8A8A"
              />
            </AppField>
          </>
        ) : null}

        <AppField label="Tipo">
          <AppOptionGroup
            options={[
              { label: 'Todos', value: '' },
              { label: 'Receitas', value: 'receita' },
              { label: 'Despesas', value: 'despesa' },
            ]}
            selectedValue={tipo}
            onChange={setTipo}
          />
        </AppField>

        <AppField label="Conta">
          <AppOptionGroup
            options={[
              { label: 'Todas', value: '' },
              ...contas.map((conta) => ({ label: conta.nome, value: conta.id })),
            ]}
            selectedValue={contaId}
            onChange={setContaId}
          />
        </AppField>

        <AppField label="Categoria">
          <AppOptionGroup
            options={[
              { label: 'Todas', value: '' },
              ...categorias.map((categoria) => ({
                label: categoria.nome,
                value: categoria.id,
              })),
            ]}
            selectedValue={categoriaId}
            onChange={setCategoriaId}
          />
        </AppField>

        <AppButton label="Gerar relatorio" onPress={handleGenerate} variant="ghost" />
      </AppCard>

      {message && relatorio ? <AppMessage tone="error" value={message} /> : null}

      {loading && !relatorio ? (
        <AppStatusCard
          title="Carregando relatorio"
          description="Estamos reunindo os dados para o periodo selecionado."
          loading
        />
      ) : null}

      {!loading && !!message && !relatorio ? (
        <AppStatusCard
          title="Nao foi possivel gerar o relatorio"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={handleGenerate}
        />
      ) : null}

      {!loading && relatorio ? (
        <>
          <AppCard>
            <Text style={styles.sectionTitle}>Resumo</Text>
            <Text style={styles.summaryText}>Periodo: {relatorio.periodoReferencia}</Text>
            <Text style={styles.summaryText}>
              Receitas: {formatCurrency(relatorio.resumo.totalReceitas)}
            </Text>
            <Text style={styles.summaryText}>
              Despesas: {formatCurrency(relatorio.resumo.totalDespesas)}
            </Text>
            <Text style={styles.summaryValue}>
              Economia: {formatCurrency(relatorio.resumo.economia)}
            </Text>
          </AppCard>

          <AppCard>
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
              <Text style={styles.emptyText}>Sem despesas para o filtro actual.</Text>
            )}
          </AppCard>

          <AppCard>
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
          </AppCard>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.body,
  },
  rowItem: {
    marginTop: ContaTheme.spacing.sm,
  },
  rowText: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
  },
  sectionTitle: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
    marginBottom: ContaTheme.spacing.sm,
  },
  summaryText: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    marginBottom: ContaTheme.spacing.xs,
  },
  summaryValue: {
    color: ContaTheme.colors.primaryStrong,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
    marginTop: ContaTheme.spacing.xs,
  },
  transactionItem: {
    marginTop: ContaTheme.spacing.sm,
  },
  transactionMeta: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xxs,
  },
  transactionTitle: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
  },
  transactionValue: {
    color: ContaTheme.colors.primaryStrong,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
    marginTop: ContaTheme.spacing.xs,
  },
});
