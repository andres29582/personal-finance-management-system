import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../../components/app-button';
import {
  AppCard,
  AppScreen,
  AppStatusCard,
} from '../../../../components/app-screen';
import { AppMessage } from '../../../../components/app-message';
import { ContaTheme } from '../../../../constants/contas-theme';
import { deactivateConta, listContas } from '../services/contaService';
import { Conta } from '../types/conta';
import { confirmAction } from '../../../../utils/confirm-action';
import { resolveApiError } from '../../../../utils/api-error';
import { formatCurrency } from '../../../../utils/formatters';

const tipoLabel: Record<Conta['tipo'], string> = {
  dinheiro: 'Dinheiro',
  banco: 'Banco',
  poupanca: 'Poupanca',
  cartao_credito: 'Cartao de credito',
};

export function ContasScreen() {
  const router = useRouter();
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadContas = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const data = await listContas();
      setContas(data);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel carregar as contas.',
      );
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
      loadContas();
    }, [loadContas]),
  );

  async function handleDeactivateConta(conta: Conta) {
    const confirmed = await confirmAction(
      'Desativar conta',
      `Deseja desativar a conta ${conta.nome}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeactivatingId(conta.id);
      setMessage('');
      await deactivateConta(conta.id);
      await loadContas();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel desativar a conta.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <AppScreen
      title="Contas"
      subtitle="Gerencie contas e acompanhe o saldo atual."
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard')}
      actionLabel="Nova"
      onActionPress={() => router.push('/contas-create')}
    >
      <AppCard>
        <AppButton label="Atualizar lista" onPress={loadContas} variant="ghost" />
      </AppCard>

      {message && contas.length ? <AppMessage tone="error" value={message} /> : null}

      {loading && !contas.length ? (
        <AppStatusCard
          title="Carregando contas"
          description="Estamos buscando as contas cadastradas."
          loading
        />
      ) : null}

      {!loading && !!message && !contas.length ? (
        <AppStatusCard
          title="Nao foi possivel carregar as contas"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadContas}
        />
      ) : null}

      {!loading && !message && !contas.length ? (
        <AppStatusCard
          title="Nenhuma conta encontrada"
          description="Crie a primeira conta para comecar a organizar seu saldo."
          actionLabel="Criar conta"
          onActionPress={() => router.push('/contas-create')}
        />
      ) : null}

      {!loading && contas.length
        ? contas.map((conta) => (
            <AppCard key={conta.id}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{conta.nome}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tipoLabel[conta.tipo]}</Text>
                </View>
              </View>
              <Text style={styles.cardValue}>{formatCurrency(conta.saldoAtual)}</Text>
              <Text style={styles.cardMeta}>
                Saldo inicial: {formatCurrency(conta.saldoInicial)}
              </Text>
              <Text style={styles.cardMeta}>Moeda: {conta.moeda || 'BRL'}</Text>
              <View style={styles.actionsRow}>
                <View style={styles.actionCell}>
                  <AppButton
                    label="Editar"
                    variant="ghost"
                    onPress={() =>
                      router.push({
                        pathname: '/contas-edit',
                        params: { id: conta.id },
                      })
                    }
                    disabled={deactivatingId === conta.id}
                  />
                </View>
                <View style={styles.actionCell}>
                  <AppButton
                    label={deactivatingId === conta.id ? 'Desativando...' : 'Desativar'}
                    variant="danger"
                    onPress={() => handleDeactivateConta(conta)}
                    disabled={deactivatingId === conta.id}
                  />
                </View>
              </View>
            </AppCard>
          ))
        : null}
    </AppScreen>
  );
}

export default ContasScreen;

const styles = StyleSheet.create({
  actionCell: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: ContaTheme.spacing.sm,
    marginTop: ContaTheme.spacing.md,
  },
  badge: {
    backgroundColor: '#DFF2E0',
    borderRadius: 999,
    paddingHorizontal: ContaTheme.spacing.sm,
    paddingVertical: ContaTheme.spacing.xxs,
  },
  badgeText: {
    color: ContaTheme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xxs,
  },
  cardTitle: {
    color: ContaTheme.colors.title,
    flex: 1,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
    marginRight: ContaTheme.spacing.sm,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: ContaTheme.spacing.xs,
  },
  cardValue: {
    color: ContaTheme.colors.title,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: ContaTheme.spacing.xxs,
  },
});
