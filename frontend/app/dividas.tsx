import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppCard, AppScreen } from '../components/app-screen';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { ContaTheme } from '../constants/contas-theme';
import { deactivateDivida, listDividas } from '../services/dividaService';
import { Divida } from '../types/divida';
import { confirmAction } from '../utils/confirm-action';
import { resolveApiError } from '../utils/api-error';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function DividasScreen() {
  const router = useRouter();
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadDividas = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      setDividas(await listDividas());
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar as dividas.');
      setMessage(resolvedError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDividas();
    }, [loadDividas]),
  );

  async function handleDeactivate(divida: Divida) {
    const confirmed = await confirmAction(
      'Desativar divida',
      `Deseja desativar ${divida.nome}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deactivateDivida(divida.id);
      await loadDividas();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel desativar a divida.',
      );
      setMessage(resolvedError.message);
    }
  }

  if (loading && !dividas.length) {
    return <AppLoading label="Carregando dividas..." />;
  }

  return (
    <AppScreen
      title="Dividas"
      subtitle="Acompanhe vencimentos e pagamentos."
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard' as never)}
      actionLabel="Nova"
      onActionPress={() => router.push('/dividas-form' as never)}
    >
      <AppMessage tone="error" value={message} />

      {dividas.length ? (
        dividas.map((divida) => (
          <AppCard key={divida.id}>
            <Text style={styles.title}>{divida.nome}</Text>
            <Text style={styles.meta}>Valor total: {formatCurrency(divida.montoTotal)}</Text>
            <Text style={styles.meta}>Inicio: {formatDate(divida.fechaInicio)}</Text>
            <Text style={styles.meta}>Vencimento: {formatDate(divida.fechaVencimiento)}</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <AppButton
                  label="Editar"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/dividas-form',
                      params: { id: divida.id },
                    } as never)
                  }
                />
              </View>
              <View style={styles.actionCell}>
                <AppButton
                  label="Pagamentos"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/pagos-divida',
                      params: { dividaId: divida.id },
                    } as never)
                  }
                />
              </View>
              <View style={styles.actionCell}>
                <AppButton
                  label="Desativar"
                  variant="danger"
                  onPress={() => handleDeactivate(divida)}
                />
              </View>
            </View>
          </AppCard>
        ))
      ) : (
        <AppCard>
          <Text style={styles.emptyText}>Nenhuma divida cadastrada.</Text>
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
