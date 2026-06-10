import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassPanel,
  GlassStatusCard,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { listMyAuditLogs } from '../services/auditLogService';
import { AuditLogItem } from '../types/audit-log';

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
    <FinanceAppShell
      activeRoute="/audit-logs"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Atualizar" onPress={() => void load(offset)} variant="ghost" />}
          eyebrow="Seguranca e LGPD"
          subtitle={`${total} registro(s) vinculados a sua conta`}
          title="Log de auditoria"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {message && items.length ? <Text style={styles.errorMessage}>{message}</Text> : null}

      {loading && !items.length ? (
        <GlassStatusCard title="Carregando" description="Buscando eventos..." loading />
      ) : null}

      {!loading && !items.length && message ? (
        <GlassStatusCard
          title="Nao foi possivel carregar o log"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={() => void load(offset)}
        />
      ) : null}

      {!loading && !items.length && !message ? (
        <GlassStatusCard title="Sem registros" description="Ainda nao ha eventos de auditoria." />
      ) : null}

      {items.map((item) => (
        <GlassPanel key={item.id} accent={item.success ? 'mixed' : 'magenta'}>
          <View style={styles.cardTop}>
            <Text style={styles.event}>{item.event}</Text>
            <View style={[styles.badge, item.success ? styles.badgeSuccess : styles.badgeFailure]}>
              <Text style={styles.badgeText}>{item.success ? 'Sucesso' : 'Falha'}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {formatWhen(item.createdAt)} - {item.module}.{item.action}
          </Text>
          {item.message ? <Text style={styles.msg}>{item.message}</Text> : null}
        </GlassPanel>
      ))}

      <View style={styles.pagination}>
        <GlassButton
          label="Anterior"
          variant="ghost"
          disabled={!hasPrev || loading}
          onPress={() => void load(Math.max(0, offset - pageSize))}
        />
        <GlassButton
          label="Proxima"
          variant="ghost"
          disabled={!hasNext || loading}
          onPress={() => void load(offset + pageSize)}
        />
      </View>
    </FinanceAppShell>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  badgeFailure: {
    backgroundColor: 'rgba(255, 122, 144, 0.10)',
    borderColor: 'rgba(255, 122, 144, 0.34)',
  },
  badgeSuccess: {
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
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  event: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
  },
  meta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xs,
  },
  msg: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xs,
  },
  pagination: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    justifyContent: 'space-between',
    marginTop: FinanceTheme.spacing.md,
  },
});

export default AuditLogsScreen;
