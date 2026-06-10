import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassPanel,
  GlassStatusCard,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { formatCurrency } from '../../../../utils/formatters';
import { listOrcamentos } from '../services/orcamentoService';
import { Orcamento, OrcamentoStatus } from '../types/orcamento';

const statusLabel: Record<OrcamentoStatus, string> = {
  alerta_80: 'Alerta 80%',
  estourado: 'Estourado',
  normal: 'Normal',
};

export function OrcamentosScreen() {
  const router = useRouter();
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadOrcamentos = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const data = await listOrcamentos(ano);
      setOrcamentos(data);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel carregar os orcamentos.',
      );
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [ano, router]);

  useFocusEffect(
    useCallback(() => {
      void loadOrcamentos();
    }, [loadOrcamentos]),
  );

  return (
    <FinanceAppShell
      activeRoute="/orcamentos"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Novo" onPress={() => router.push('/orcamentos-form' as never)} />}
          eyebrow="Planejamento"
          subtitle="Controle o teto mensal de despesas."
          title="Orcamentos"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassField label="Ano">
          <GlassTextInput
            keyboardType="number-pad"
            placeholder="2026"
            value={ano}
            onChangeText={setAno}
          />
        </GlassField>
        <GlassButton label="Atualizar" onPress={loadOrcamentos} variant="ghost" />
      </GlassPanel>

      {message && orcamentos.length ? <Text style={styles.errorMessage}>{message}</Text> : null}

      {loading && !orcamentos.length ? (
        <GlassStatusCard
          title="Carregando orcamentos"
          description="Estamos buscando os orcamentos do ano selecionado."
          loading
        />
      ) : null}

      {!loading && !!message && !orcamentos.length ? (
        <GlassStatusCard
          title="Nao foi possivel carregar os orcamentos"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadOrcamentos}
        />
      ) : null}

      {!loading && !message && !orcamentos.length ? (
        <GlassStatusCard
          title="Nenhum orcamento encontrado"
          description="Crie um orcamento mensal para acompanhar o limite de gastos."
          actionLabel="Novo orcamento"
          onActionPress={() => router.push('/orcamentos-form' as never)}
        />
      ) : null}

      {!loading && orcamentos.length
        ? orcamentos.map((orcamento) => (
            <GlassPanel
              key={orcamento.id}
              accent={orcamento.statusAlerta === 'normal' ? 'cyan' : 'magenta'}
            >
              <View style={styles.cardTop}>
                <Text style={styles.title}>{orcamento.mesReferencia}</Text>
                <View
                  style={[
                    styles.badge,
                    orcamento.statusAlerta === 'normal'
                      ? styles.badgeNormal
                      : styles.badgeAlert,
                  ]}
                >
                  <Text style={styles.badgeText}>{statusLabel[orcamento.statusAlerta]}</Text>
                </View>
              </View>
              <Text style={styles.value}>{formatCurrency(orcamento.valorPlanejado)}</Text>
              <Text style={styles.meta}>Gasto atual: {formatCurrency(orcamento.gastoAtual)}</Text>
              <Text style={styles.meta}>Restante: {formatCurrency(orcamento.restante)}</Text>
              <Text style={styles.meta}>Utilizado: {orcamento.percentualUtilizado}%</Text>
              <View style={styles.actions}>
                <GlassButton
                  label="Editar"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/orcamentos-form',
                      params: { id: orcamento.id },
                    } as never)
                  }
                />
              </View>
            </GlassPanel>
          ))
        : null}
    </FinanceAppShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: FinanceTheme.spacing.md,
  },
  badge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  badgeAlert: {
    backgroundColor: FinanceTheme.colors.magentaSoft,
    borderColor: FinanceTheme.neon.magenta.borderColor,
  },
  badgeNormal: {
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
    marginBottom: FinanceTheme.spacing.xs,
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
    flex: 1,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
  },
  value: {
    color: FinanceTheme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: FinanceTheme.spacing.xs,
  },
});

export default OrcamentosScreen;
