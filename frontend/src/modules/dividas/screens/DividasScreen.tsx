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
import { deactivateDivida, listDividas } from '../services/dividaService';
import { Divida } from '../types/divida';
import { confirmAction } from '../../../../utils/confirm-action';
import { resolveApiError } from '../../../../utils/api-error';
import { formatCurrency, formatDate } from '../../../../utils/formatters';

export function DividasScreen() {
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
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

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
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    }
  }

  return (
    <FinanceAppShell
      activeRoute="/dividas"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Nova" onPress={() => router.push('/dividas-form' as never)} />}
          eyebrow="Compromissos"
          subtitle="Acompanhe vencimentos e pagamentos."
          title="Dividas"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {message && dividas.length ? <Text style={styles.errorMessage}>{message}</Text> : null}

      {loading && !dividas.length ? (
        <GlassStatusCard
          title="Carregando dividas"
          description="Estamos buscando seus compromissos cadastrados."
          loading
        />
      ) : null}

      {!loading && !!message && !dividas.length ? (
        <GlassStatusCard
          title="Nao foi possivel carregar as dividas"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadDividas}
        />
      ) : null}

      {!loading && !message && !dividas.length ? (
        <GlassStatusCard
          title="Nenhuma divida cadastrada"
          description="Cadastre uma divida para acompanhar vencimentos e pagamentos."
          actionLabel="Nova divida"
          onActionPress={() => router.push('/dividas-form' as never)}
        />
      ) : null}

      {!loading && dividas.length ? (
        dividas.map((divida) => (
          <GlassPanel key={divida.id} accent="magenta">
            <Text style={styles.title}>{divida.nome}</Text>
            <Text style={styles.meta}>Valor total: {formatCurrency(divida.montoTotal)}</Text>
            <Text style={styles.meta}>Inicio: {formatDate(divida.fechaInicio)}</Text>
            <Text style={styles.meta}>Vencimento: {formatDate(divida.fechaVencimiento)}</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <GlassButton
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
                <GlassButton
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
                <GlassButton
                  label="Desativar"
                  variant="danger"
                  onPress={() => handleDeactivate(divida)}
                />
              </View>
            </View>
          </GlassPanel>
        ))
      ) : null}
    </FinanceAppShell>
  );
}

export default DividasScreen;

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
