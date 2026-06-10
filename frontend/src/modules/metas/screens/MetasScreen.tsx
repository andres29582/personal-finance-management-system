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
import { deactivateMeta, listMetas } from '../services/metaService';
import { Meta } from '../types/meta';
import { confirmAction } from '../../../../utils/confirm-action';
import { resolveApiError } from '../../../../utils/api-error';
import { formatCurrency, formatDate } from '../../../../utils/formatters';

export function MetasScreen() {
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
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

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
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    }
  }

  return (
    <FinanceAppShell
      activeRoute="/metas"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Nova" onPress={() => router.push('/metas-form' as never)} />}
          eyebrow="Planejamento"
          subtitle="Acompanhe objetivos de economia e reducao de divida."
          title="Metas"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {message && metas.length ? <Text style={styles.errorMessage}>{message}</Text> : null}

      {loading && !metas.length ? (
        <GlassStatusCard
          title="Carregando metas"
          description="Estamos buscando seus objetivos financeiros."
          loading
        />
      ) : null}

      {!loading && !!message && !metas.length ? (
        <GlassStatusCard
          title="Nao foi possivel carregar as metas"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadMetas}
        />
      ) : null}

      {!loading && !message && !metas.length ? (
        <GlassStatusCard
          title="Nenhuma meta cadastrada"
          description="Crie uma meta para acompanhar progresso e prazos."
          actionLabel="Nova meta"
          onActionPress={() => router.push('/metas-form' as never)}
        />
      ) : null}

      {!loading && metas.length ? (
        metas.map((meta) => (
          <GlassPanel key={meta.id} accent="cyan">
            <Text style={styles.title}>{meta.nome}</Text>
            <Text style={styles.meta}>Tipo: {meta.tipo}</Text>
            <Text style={styles.meta}>
              Progresso: {formatCurrency(meta.montoActual)} / {formatCurrency(meta.montoObjetivo)}
            </Text>
            <Text style={styles.meta}>Limite: {formatDate(meta.fechaLimite)}</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <GlassButton
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
                <GlassButton
                  label="Desativar"
                  variant="danger"
                  onPress={() => handleDeactivate(meta)}
                />
              </View>
            </View>
          </GlassPanel>
        ))
      ) : null}
    </FinanceAppShell>
  );
}

export default MetasScreen;

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
});
