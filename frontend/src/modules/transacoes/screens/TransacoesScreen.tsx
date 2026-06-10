import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { listCategorias } from '../../categorias/services/categoriaService';
import { Categoria } from '../../categorias/types/categoria';
import { listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import { listTransacoes, removeTransacao } from '../services/transacaoService';
import { TipoTransacao, Transacao } from '../types/transacao';
import { resolveApiError } from '../../../../utils/api-error';
import { confirmAction } from '../../../../utils/confirm-action';
import { formatCurrency, formatDate, getCurrentMonthReference } from '../../../../utils/formatters';

export function TransacoesScreen() {
  const router = useRouter();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [mes, setMes] = useState(getCurrentMonthReference());
  const [tipo, setTipo] = useState<string>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const categoriaMap = useMemo(
    () => new Map(categorias.map((categoria) => [categoria.id, categoria])),
    [categorias],
  );
  const contaMap = useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta])),
    [contas],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const [contasData, categoriasData, transacoesData] = await Promise.all([
        listContas(),
        listCategorias(),
        listTransacoes({
          mes,
          tipo: tipo ? (tipo as TipoTransacao) : undefined,
        }),
      ]);
      setContas(contasData);
      setCategorias(categoriasData);
      setTransacoes(transacoesData);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel carregar as transacoes.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [mes, router, tipo]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function handleRemove(id: string) {
    const confirmed = await confirmAction(
      'Excluir transacao',
      'Deseja remover esta transacao?',
    );

    if (!confirmed) {
      return;
    }

    try {
      await removeTransacao(id);
      await loadData();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel excluir a transacao.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    }
  }

  return (
    <FinanceAppShell
      activeRoute="/transacoes"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Nova" onPress={() => router.push('/transacoes-form' as never)} />}
          eyebrow="Movimentacoes"
          subtitle="Registre receitas e despesas."
          title="Transacoes"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassField label="Mes (YYYY-MM)">
          <GlassTextInput
            value={mes}
            onChangeText={setMes}
            placeholder="2026-04"
          />
        </GlassField>

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

        <GlassButton label="Aplicar filtros" onPress={loadData} variant="ghost" />
      </GlassPanel>

      {message && transacoes.length ? <Text style={styles.errorMessage}>{message}</Text> : null}

      {loading && !transacoes.length ? (
        <GlassStatusCard
          title="Carregando transacoes"
          description="Estamos buscando as transacoes do periodo selecionado."
          loading
        />
      ) : null}

      {!loading && !!message && !transacoes.length ? (
        <GlassStatusCard
          title="Nao foi possivel carregar as transacoes"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadData}
        />
      ) : null}

      {!loading && !message && !transacoes.length ? (
        <GlassStatusCard
          title="Nenhuma transacao encontrada"
          description="Registre uma receita ou despesa para preencher o historico."
          actionLabel="Nova transacao"
          onActionPress={() => router.push('/transacoes-form' as never)}
        />
      ) : null}

      {!loading && transacoes.length
        ? transacoes.map((transacao) => (
            <GlassPanel key={transacao.id} accent={transacao.tipo === 'receita' ? 'cyan' : 'magenta'}>
              <View style={styles.cardTop}>
                <Text style={styles.title}>
                  {transacao.descricao ||
                    categoriaMap.get(transacao.categoriaId)?.nome ||
                    'Transacao'}
                </Text>
                <View
                  style={[
                    styles.badge,
                    transacao.tipo === 'receita' ? styles.badgeIncome : styles.badgeExpense,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {transacao.tipo === 'receita' ? 'Receita' : 'Despesa'}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {formatDate(transacao.data)} - {categoriaMap.get(transacao.categoriaId)?.nome || 'Categoria'}
              </Text>
              <Text style={styles.meta}>
                Conta: {contaMap.get(transacao.contaId)?.nome || '-'}
              </Text>
              <Text style={styles.value}>{formatCurrency(transacao.valor)}</Text>
              <View style={styles.actions}>
                <View style={styles.actionCell}>
                  <GlassButton
                    label="Editar"
                    variant="ghost"
                    onPress={() =>
                      router.push({
                        pathname: '/transacoes-form',
                        params: { id: transacao.id },
                      } as never)
                    }
                  />
                </View>
                <View style={styles.actionCell}>
                  <GlassButton
                    label="Excluir"
                    variant="danger"
                    onPress={() => handleRemove(transacao.id)}
                  />
                </View>
              </View>
            </GlassPanel>
          ))
        : null}
    </FinanceAppShell>
  );
}

export default TransacoesScreen;

const styles = StyleSheet.create({
  actionCell: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginTop: FinanceTheme.spacing.md,
  },
  badge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  badgeExpense: {
    backgroundColor: FinanceTheme.colors.magentaSoft,
    borderColor: FinanceTheme.neon.magenta.borderColor,
  },
  badgeIncome: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  badgeText: {
    color: FinanceTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.xs,
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
    flex: 1,
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
