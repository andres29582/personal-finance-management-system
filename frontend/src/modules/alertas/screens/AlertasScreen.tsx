import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassPanel,
  GlassStatusCard,
} from '../../../shared/ui';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import {
  deactivateAlerta,
  listAlertas,
  markAlertaAsNotified,
} from '../services/alertaService';
import { Alerta } from '../types/alerta';
import { confirmAction } from '../../../../utils/confirm-action';
import { resolveApiError } from '../../../../utils/api-error';

export function AlertasScreen() {
  const router = useRouter();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadAlertas = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      setAlertas(await listAlertas());
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar os alertas.');
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadAlertas();
    }, [loadAlertas]),
  );

  async function handleMarkNotified(id: string) {
    try {
      await markAlertaAsNotified(id);
      await loadAlertas();
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel marcar o alerta.');
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    }
  }

  async function handleDeactivate(alerta: Alerta) {
    const confirmed = await confirmAction(
      'Desativar alerta',
      `Deseja desativar ${alerta.tipo}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deactivateAlerta(alerta.id);
      await loadAlertas();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel desativar o alerta.',
      );
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    }
  }

  return (
    <FinanceAppShell
      activeRoute="/alertas"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Novo" onPress={() => router.push('/alertas-form' as never)} />}
          eyebrow="Monitoramento"
          subtitle="Alertas in-app para metas, dividas e limite de gasto."
          title="Alertas"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {message && alertas.length ? <Text style={styles.errorMessage}>{message}</Text> : null}

      {loading && !alertas.length ? (
        <GlassStatusCard
          title="Carregando alertas"
          description="Estamos buscando os alertas cadastrados."
          loading
        />
      ) : null}

      {!loading && !!message && !alertas.length ? (
        <GlassStatusCard
          title="Nao foi possivel carregar os alertas"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadAlertas}
        />
      ) : null}

      {!loading && !message && !alertas.length ? (
        <GlassStatusCard
          title="Nenhum alerta cadastrado"
          description="Crie alertas para acompanhar metas, dividas e limites."
          actionLabel="Novo alerta"
          onActionPress={() => router.push('/alertas-form' as never)}
        />
      ) : null}

      {!loading && alertas.length ? (
        alertas.map((alerta) => (
          <GlassPanel key={alerta.id} accent="mixed">
            <Text style={styles.title}>{alerta.tipo}</Text>
            <Text style={styles.meta}>Referencia: {alerta.referenciaId}</Text>
            <Text style={styles.meta}>Antecipacao: {alerta.diasAnticipacion} dias</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <GlassButton
                  label="Editar"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/alertas-form',
                      params: { id: alerta.id },
                    } as never)
                  }
                />
              </View>
              <View style={styles.actionCell}>
                <GlassButton
                  label="Notificado"
                  variant="ghost"
                  onPress={() => handleMarkNotified(alerta.id)}
                />
              </View>
              <View style={styles.actionCell}>
                <GlassButton
                  label="Desativar"
                  variant="danger"
                  onPress={() => handleDeactivate(alerta)}
                />
              </View>
            </View>
          </GlassPanel>
        ))
      ) : null}
    </FinanceAppShell>
  );
}

const styles = StyleSheet.create({
  actionCell: { flex: 1 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
});

export default AlertasScreen;
