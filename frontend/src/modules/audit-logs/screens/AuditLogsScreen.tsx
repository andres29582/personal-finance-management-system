import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '../../../../components/app-button';
import { AppMessage } from '../../../../components/app-message';
import { AppCard, AppScreen, AppStatusCard } from '../../../../components/app-screen';
import { ContaTheme } from '../../../../constants/contas-theme';
import { listMyAuditLogs } from '../services/auditLogService';
import { AuditLogItem } from '../types/audit-log';
import { resolveApiError } from '../../../../utils/api-error';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

export function AuditLogsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const pageSize = 30;

  const load = useCallback(async (nextOffset: number) => {
    try {
      setLoading(true);
      setMessage('');
      const res = await listMyAuditLogs({ limit: pageSize, offset: nextOffset });
      setItems(res.items);
      setTotal(res.total);
      setOffset(nextOffset);
    } catch (error) {
      const resolved = await resolveApiError(
        error,
        'Nao foi possivel carregar o log de auditoria.',
      );
      setMessage(resolved.message);
      if (resolved.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load(0);
  }, [load]);

  const hasPrev = offset > 0;
  const hasNext = offset + items.length < total;

  return (
    <AppScreen
      title="Log de auditoria"
      subtitle={`${total} registro(s) vinculados a sua conta`}
      backLabel="Voltar"
      onBackPress={() => router.back()}
    >
      {message ? <AppMessage tone="error" value={message} /> : null}

      {loading && !items.length ? (
        <AppStatusCard title="Carregando" description="Buscando eventos..." loading />
      ) : null}

      {!loading && !items.length && !message ? (
        <AppStatusCard title="Sem registros" description="Ainda nao ha eventos de auditoria." />
      ) : null}

      {items.map((item) => (
        <AppCard key={item.id}>
          <Text style={styles.event}>{item.event}</Text>
          <Text style={styles.meta}>
            {formatWhen(item.createdAt)} · {item.module}.{item.action}
            {item.success ? '' : ' · falha'}
          </Text>
          {item.message ? <Text style={styles.msg}>{item.message}</Text> : null}
        </AppCard>
      ))}

      <View style={styles.pagination}>
        <AppButton
          label="Anterior"
          variant="ghost"
          disabled={!hasPrev || loading}
          onPress={() => void load(Math.max(0, offset - pageSize))}
        />
        <AppButton
          label="Proxima"
          variant="ghost"
          disabled={!hasNext || loading}
          onPress={() => void load(offset + pageSize)}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  event: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
  },
  meta: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xxs,
  },
  msg: {
    color: ContaTheme.colors.text,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xs,
  },
  pagination: {
    flexDirection: 'row',
    gap: ContaTheme.spacing.sm,
    justifyContent: 'space-between',
    marginTop: ContaTheme.spacing.md,
  },
});

export default AuditLogsScreen;
