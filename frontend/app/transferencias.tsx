import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppCard, AppScreen } from '../components/app-screen';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { ContaTheme } from '../constants/contas-theme';
import { listContas } from '../services/contaService';
import {
  listTransferencias,
  removeTransferencia,
} from '../services/transferenciaService';
import { Conta } from '../types/conta';
import { Transferencia } from '../types/transferencia';
import { confirmAction } from '../utils/confirm-action';
import { resolveApiError } from '../utils/api-error';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function TransferenciasScreen() {
  const router = useRouter();
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const contaMap = useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta])),
    [contas],
  );

  const loadTransferencias = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const [contasData, transferenciasData] = await Promise.all([
        listContas(),
        listTransferencias(),
      ]);
      setContas(contasData);
      setTransferencias(transferenciasData);
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar transferencias.');
      setMessage(resolvedError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTransferencias();
    }, [loadTransferencias]),
  );

  async function handleRemove(id: string) {
    const confirmed = await confirmAction(
      'Excluir transferencia',
      'Deseja remover esta transferencia?',
    );

    if (!confirmed) {
      return;
    }

    try {
      await removeTransferencia(id);
      await loadTransferencias();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel excluir a transferencia.',
      );
      setMessage(resolvedError.message);
    }
  }

  if (loading && !transferencias.length) {
    return <AppLoading label="Carregando transferencias..." />;
  }

  return (
    <AppScreen
      title="Transferencias"
      subtitle="Movimente valores entre contas sem afetar receitas e despesas."
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard' as never)}
      actionLabel="Nova"
      onActionPress={() => router.push('/transferencias-form' as never)}
    >
      <AppMessage tone="error" value={message} />

      {transferencias.length ? (
        transferencias.map((transferencia) => (
          <AppCard key={transferencia.id}>
            <Text style={styles.title}>{transferencia.descricao || 'Transferencia interna'}</Text>
            <Text style={styles.meta}>
              {`${contaMap.get(transferencia.contaOrigemId)?.nome || '-'} -> ${contaMap.get(transferencia.contaDestinoId)?.nome || '-'}`}
            </Text>
            <Text style={styles.meta}>{formatDate(transferencia.data)}</Text>
            <Text style={styles.meta}>Comissao: {formatCurrency(transferencia.comissao)}</Text>
            <Text style={styles.value}>{formatCurrency(transferencia.valor)}</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <AppButton
                  label="Editar"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/transferencias-form',
                      params: { id: transferencia.id },
                    } as never)
                  }
                />
              </View>
              <View style={styles.actionCell}>
                <AppButton label="Excluir" variant="danger" onPress={() => handleRemove(transferencia.id)} />
              </View>
            </View>
          </AppCard>
        ))
      ) : (
        <AppCard>
          <Text style={styles.emptyText}>Nenhuma transferencia cadastrada.</Text>
        </AppCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actionCell: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: ContaTheme.spacing.sm,
    marginTop: ContaTheme.spacing.sm,
  },
  emptyText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.body,
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
