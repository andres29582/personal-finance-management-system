import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppCard, AppScreen } from '../components/app-screen';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { ContaTheme } from '../constants/contas-theme';
import { deactivateMeta, listMetas } from '../services/metaService';
import { Meta } from '../types/meta';
import { confirmAction } from '../utils/confirm-action';
import { resolveApiError } from '../utils/api-error';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function MetasScreen() {
  const router = useRouter();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadMetas = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      setMetas(await listMetas());
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar as metas.');
      setMessage(resolvedError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMetas();
    }, [loadMetas]),
  );

  async function handleDeactivate(meta: Meta) {
    const confirmed = await confirmAction(
      'Desativar meta',
      `Deseja desativar ${meta.nome}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deactivateMeta(meta.id);
      await loadMetas();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel desativar a meta.',
      );
      setMessage(resolvedError.message);
    }
  }

  if (loading && !metas.length) {
    return <AppLoading label="Carregando metas..." />;
  }

  return (
    <AppScreen
      title="Metas"
      subtitle="Acompanhe objetivos de economia e reducao de divida."
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard' as never)}
      actionLabel="Nova"
      onActionPress={() => router.push('/metas-form' as never)}
    >
      <AppMessage tone="error" value={message} />

      {metas.length ? (
        metas.map((meta) => (
          <AppCard key={meta.id}>
            <Text style={styles.title}>{meta.nome}</Text>
            <Text style={styles.meta}>Tipo: {meta.tipo}</Text>
            <Text style={styles.meta}>
              Progresso: {formatCurrency(meta.montoActual)} / {formatCurrency(meta.montoObjetivo)}
            </Text>
            <Text style={styles.meta}>Limite: {formatDate(meta.fechaLimite)}</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <AppButton
                  label="Editar"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/metas-form',
                      params: { id: meta.id },
                    } as never)
                  }
                />
              </View>
              <View style={styles.actionCell}>
                <AppButton
                  label="Desativar"
                  variant="danger"
                  onPress={() => handleDeactivate(meta)}
                />
              </View>
            </View>
          </AppCard>
        ))
      ) : (
        <AppCard>
          <Text style={styles.emptyText}>Nenhuma meta cadastrada.</Text>
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
