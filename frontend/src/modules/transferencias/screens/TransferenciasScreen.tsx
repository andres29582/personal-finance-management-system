import { createHistoryRequestFence } from '../../../shared/hooks/historyRequestFence';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AppShell,
  FinanceAppHeader,
  GlassButton,
  GlassPanel,
  GlassStatusCard,
} from '../../../shared/ui';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import {
  listTransferencias,
  removeTransferencia,
} from '../services/transferenciaService';
import { Transferencia } from '../types/transferencia';
import { confirmAction } from '../../../../utils/confirm-action';
import { resolveApiError } from '../../../../utils/api-error';
import { formatCurrency, formatDate } from '../../../../utils/formatters';

export function TransferenciasScreen() {
  const router = useRouter();
  const [requests] = useState(createHistoryRequestFence);
  const [offset, setOffset] = useState(0);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const contaMap = useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta])),
    [contas],
  );

  const loadTransferencias = useCallback(async () => {
    const request = requests.start();
    if (!requests.current(request)) return;
    try {
      setLoading(true);
      setMessage('');
      const [contasData, transferenciasData] = await Promise.all([
        listContas(),
        listTransferencias({ limit: 50, offset }),
      ]);
      if (!requests.current(request)) return;
      if (!transferenciasData.length && offset > 0) { setTransferencias([]); requests.invalidate(); setOffset(current => Math.max(0, current - 50)); return; }
      setContas(contasData);
      setTransferencias(transferenciasData);
    } catch (error) {
      if (!requests.current(request)) return;
      const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar transferencias.');
      if (!requests.current(request)) return;
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (requests.current(request)) setLoading(false);
    }
  }, [router, offset, requests]);

  useFocusEffect(
    useCallback(() => {
      requests.focus();
      void loadTransferencias();
      return () => requests.blur();
    }, [loadTransferencias, requests]),
  );

  async function handleRemove(id: string) {
    const request = requests.capture();
    const confirmed = await confirmAction(
      'Excluir transferencia',
      'Deseja remover esta transferencia?',
    );

    if (!requests.current(request) || !confirmed) {
      return;
    }

    try {
      await removeTransferencia(id);
      if (!requests.current(request)) return;
      await loadTransferencias();
    } catch (error) {
      if (!requests.current(request)) return;
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel excluir a transferencia.',
      );
      if (!requests.current(request)) return;
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    }
  }

  return (
    <AppShell
      activeRoute="/transferencias"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          eyebrow="Movimentacoes"
          subtitle="Movimente valores entre contas sem afetar receitas e despesas."
          title="Transferencias"
        />
      }
    >
      {message && transferencias.length ? (
        <Text style={styles.errorMessage}>{message}</Text>
      ) : null}

      {loading && !transferencias.length ? (
        <GlassStatusCard
          title="Carregando transferencias"
          description="Estamos buscando as movimentacoes entre contas."
          loading
        />
      ) : null}

      {!loading && !!message && !transferencias.length ? (
        <GlassStatusCard
          title="Nao foi possivel carregar transferencias"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadTransferencias}
        />
      ) : null}

      {!loading && !message && !transferencias.length ? (
        <GlassStatusCard
          title="Nenhuma transferencia cadastrada"
          description="Use o menu + para registrar uma movimentacao interna entre contas."
        />
      ) : null}

      {!loading && transferencias.length ? (
        transferencias.map((transferencia) => (
          <GlassPanel key={transferencia.id} accent="mixed">
            <Text style={styles.title}>{transferencia.descricao || 'Transferencia interna'}</Text>
            <Text style={styles.meta}>
              {`${contaMap.get(transferencia.contaOrigemId)?.nome || '-'} -> ${contaMap.get(transferencia.contaDestinoId)?.nome || '-'}`}
            </Text>
            <Text style={styles.meta}>{formatDate(transferencia.data)}</Text>
            <Text style={styles.meta}>Comissao: {formatCurrency(transferencia.comissao)}</Text>
            <Text style={styles.value}>{formatCurrency(transferencia.valor)}</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <GlassButton
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
                <GlassButton label="Excluir" variant="danger" onPress={() => handleRemove(transferencia.id)} />
              </View>
            </View>
          </GlassPanel>
        ))
      ) : null}

      <View style={styles.actions}>
        <GlassButton label="Pagina anterior" variant="ghost" disabled={loading || offset === 0}
          onPress={() => { requests.invalidate(); setTransferencias([]); const next = Math.max(0, offset - 50); setOffset(next); }} />
        <Text accessibilityLiveRegion="polite" style={styles.meta}>Pagina {offset / 50 + 1}</Text>
        <GlassButton label="Proxima pagina" variant="ghost" disabled={loading || transferencias.length < 50}
          onPress={() => { requests.invalidate(); setTransferencias([]); const next = offset + 50; setOffset(next); }} />
      </View>
    </AppShell>
  );
}

export default TransferenciasScreen;

const styles = StyleSheet.create({
  actionCell: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
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
    color: FinanceTheme.colors.cyanMuted,
    fontSize: 22,
    fontWeight: '900',
    marginTop: FinanceTheme.spacing.sm,
  },
});
