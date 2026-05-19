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
    <FinanceAppShell
      activeRoute="/contas"
      header={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Nova"
              onPress={() => router.push('/contas-create' as never)}
            />
          }
          eyebrow="Gestao financeira"
          subtitle="Gerencie contas e acompanhe o saldo atual."
          title="Contas"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassButton
          label="Atualizar lista"
          onPress={loadContas}
          variant="ghost"
        />
      </GlassPanel>

      {message && contas.length ? (
        <Text style={styles.errorMessage}>{message}</Text>
      ) : null}

      {loading && !contas.length ? (
        <GlassStatusCard
          title="Carregando contas"
          description="Estamos buscando as contas cadastradas."
          loading
        />
      ) : null}

      {!loading && !!message && !contas.length ? (
        <GlassStatusCard
          title="Nao foi possivel carregar as contas"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadContas}
        />
      ) : null}

      {!loading && !message && !contas.length ? (
        <GlassStatusCard
          title="Nenhuma conta encontrada"
          description="Crie a primeira conta para comecar a organizar seu saldo."
          actionLabel="Criar conta"
          onActionPress={() => router.push('/contas-create' as never)}
        />
      ) : null}

      {!loading && contas.length
        ? contas.map((conta) => (
            <GlassPanel key={conta.id} accent="cyan">
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
                  <GlassButton
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
                  <GlassButton
                    label={deactivatingId === conta.id ? 'Desativando...' : 'Desativar'}
                    variant="danger"
                    onPress={() => handleDeactivateConta(conta)}
                    disabled={deactivatingId === conta.id}
                  />
                </View>
              </View>
            </GlassPanel>
          ))
        : null}
    </FinanceAppShell>
  );
}

export default ContasScreen;

const styles = StyleSheet.create({
  actionCell: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginTop: FinanceTheme.spacing.md,
  },
  badge: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  badgeText: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  cardMeta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  cardTitle: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
    marginRight: FinanceTheme.spacing.sm,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.xs,
  },
  cardValue: {
    color: FinanceTheme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: FinanceTheme.spacing.xxs,
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
});
