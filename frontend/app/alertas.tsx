import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppCard, AppScreen } from '../components/app-screen';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { ContaTheme } from '../constants/contas-theme';
import {
  deactivateAlerta,
  listAlertas,
  markAlertaAsNotified,
} from '../services/alertaService';
import { Alerta } from '../types/alerta';
import { confirmAction } from '../utils/confirm-action';
import { resolveApiError } from '../utils/api-error';

export default function AlertasScreen() {
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
    } finally {
      setLoading(false);
    }
  }, []);

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
    }
  }

  if (loading && !alertas.length) {
    return <AppLoading label="Carregando alertas..." />;
  }

  return (
    <AppScreen
      title="Alertas"
      subtitle="Alertas in-app para metas, dividas e limite de gasto."
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard' as never)}
      actionLabel="Novo"
      onActionPress={() => router.push('/alertas-form' as never)}
    >
      <AppMessage tone="error" value={message} />

      {alertas.length ? (
        alertas.map((alerta) => (
          <AppCard key={alerta.id}>
            <Text style={styles.title}>{alerta.tipo}</Text>
            <Text style={styles.meta}>Referencia: {alerta.referenciaId}</Text>
            <Text style={styles.meta}>Antecipacao: {alerta.diasAnticipacion} dias</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <AppButton
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
                <AppButton
                  label="Notificado"
                  variant="ghost"
                  onPress={() => handleMarkNotified(alerta.id)}
                />
              </View>
              <View style={styles.actionCell}>
                <AppButton
                  label="Desativar"
                  variant="danger"
                  onPress={() => handleDeactivate(alerta)}
                />
              </View>
            </View>
          </AppCard>
        ))
      ) : (
        <AppCard>
          <Text style={styles.emptyText}>Nenhum alerta cadastrado.</Text>
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
});
