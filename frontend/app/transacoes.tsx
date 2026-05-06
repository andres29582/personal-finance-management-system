import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { listTransacoes, removeTransacao } from '../services/transacaoService';
import { Categoria } from '../types/categoria';
import { Conta } from '../types/conta';
import { TipoTransacao, Transacao } from '../types/transacao';
import { resolveApiError } from '../utils/api-error';
import { confirmAction } from '../utils/confirm-action';
import { formatCurrency, formatDate, getCurrentMonthReference } from '../utils/formatters';

export default function TransacoesScreen() {
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
    }
  }

  return (
    <AppScreen
      title="Transacoes"
      subtitle="Registre receitas e despesas."
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard' as never)}
      actionLabel="Nova"
      onActionPress={() => router.push('/transacoes-form' as never)}
    >
      <AppCard>
        <AppField label="Mes (YYYY-MM)">
          <TextInput
            style={appInputStyles.input}
            value={mes}
            onChangeText={setMes}
            placeholder="2026-04"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

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

        <AppButton label="Aplicar filtros" onPress={loadData} variant="ghost" />
      </AppCard>

      {message && transacoes.length ? <AppMessage tone="error" value={message} /> : null}

      {loading && !transacoes.length ? (
        <AppStatusCard
          title="Carregando transacoes"
          description="Estamos buscando as transacoes do periodo selecionado."
          loading
        />
      ) : null}

      {!loading && !!message && !transacoes.length ? (
        <AppStatusCard
          title="Nao foi possivel carregar as transacoes"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadData}
        />
      ) : null}

      {!loading && !message && !transacoes.length ? (
        <AppStatusCard
          title="Nenhuma transacao encontrada"
          description="Registre uma receita ou despesa para preencher o historico."
          actionLabel="Nova transacao"
          onActionPress={() => router.push('/transacoes-form' as never)}
        />
      ) : null}

      {!loading && transacoes.length
        ? transacoes.map((transacao) => (
            <AppCard key={transacao.id}>
              <Text style={styles.title}>
                {transacao.descricao ||
                  categoriaMap.get(transacao.categoriaId)?.nome ||
                  'Transacao'}
              </Text>
              <Text style={styles.meta}>
                {formatDate(transacao.data)} - {transacao.tipo}
              </Text>
              <Text style={styles.meta}>
                Conta: {contaMap.get(transacao.contaId)?.nome || '-'}
              </Text>
              <Text style={styles.value}>{formatCurrency(transacao.valor)}</Text>
              <View style={styles.actions}>
                <View style={styles.actionCell}>
                  <AppButton
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
                  <AppButton
                    label="Excluir"
                    variant="danger"
                    onPress={() => handleRemove(transacao.id)}
                  />
                </View>
              </View>
            </AppCard>
          ))
        : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actionCell: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: ContaTheme.spacing.sm,
    marginTop: ContaTheme.spacing.sm,
  },
  meta: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xxs,
  },
  title: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
  },
  value: {
    color: ContaTheme.colors.primaryStrong,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
    marginTop: ContaTheme.spacing.sm,
  },
});
