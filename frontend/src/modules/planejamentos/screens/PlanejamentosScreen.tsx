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
  GlassOptionGroup,
  GlassPanel,
  GlassStatusCard,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { formatDate } from '../../../../utils/formatters';
import { listPlanejamentos } from '../services/planejamentoService';
import {
  Planejamento,
  PlanejamentoStatus,
  PlanejamentoTipo,
} from '../types/planejamento';

type PlanejamentoStatusFilter = PlanejamentoStatus | 'TODOS';

const statusFilterOptions: { label: string; value: PlanejamentoStatusFilter }[] = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Abertos', value: 'ABERTO' },
  { label: 'Fechados', value: 'FECHADO' },
  { label: 'Arquivados', value: 'ARQUIVADO' },
  { label: 'Cancelados', value: 'CANCELADO' },
];

const statusLabel: Record<PlanejamentoStatus, string> = {
  ABERTO: 'Aberto',
  ARQUIVADO: 'Arquivado',
  CANCELADO: 'Cancelado',
  FECHADO: 'Fechado',
};

const tipoLabel: Record<PlanejamentoTipo, string> = {
  CASA: 'Casa',
  EVENTO: 'Evento',
  FESTA: 'Festa',
  GRUPO: 'Grupo',
  OUTRO: 'Outro',
  VIAGEM: 'Viagem',
};

function formatOptionalDate(date: string | null | undefined) {
  return date ? formatDate(date.slice(0, 10)) : '-';
}

export function PlanejamentosScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] =
    useState<PlanejamentoStatusFilter>('TODOS');
  const [planejamentos, setPlanejamentos] = useState<Planejamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadPlanejamentos = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const data = await listPlanejamentos(
        statusFilter === 'TODOS' ? undefined : statusFilter,
      );
      setPlanejamentos(data);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel carregar os planejamentos.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadPlanejamentos();
    }, [loadPlanejamentos]),
  );

  return (
    <FinanceAppShell
      activeRoute="/planejamentos"
      header={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Novo"
              onPress={() => router.push('/planejamentos-form' as never)}
            />
          }
          eyebrow="Planejamento compartilhado"
          subtitle="Organize despesas de casa, viagens, festas e grupos."
          title="Planejamentos"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassField label="Status">
          <GlassOptionGroup
            options={statusFilterOptions}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </GlassField>
        <GlassButton
          label="Atualizar lista"
          onPress={loadPlanejamentos}
          variant="ghost"
        />
      </GlassPanel>

      {message && planejamentos.length ? (
        <Text style={styles.errorMessage}>{message}</Text>
      ) : null}

      {loading && !planejamentos.length ? (
        <GlassStatusCard
          title="Carregando planejamentos"
          description="Estamos buscando seus planejamentos compartilhados."
          loading
        />
      ) : null}

      {!loading && !!message && !planejamentos.length ? (
        <GlassStatusCard
          title="Nao foi possivel carregar os planejamentos"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadPlanejamentos}
        />
      ) : null}

      {!loading && !message && !planejamentos.length ? (
        <GlassStatusCard
          title="Nenhum planejamento encontrado"
          description="Crie um planejamento para dividir custos com outras pessoas."
          actionLabel="Novo planejamento"
          onActionPress={() => router.push('/planejamentos-form' as never)}
        />
      ) : null}

      {!loading && planejamentos.length
        ? planejamentos.map((planejamento) => (
            <GlassPanel key={planejamento.id} accent="cyan">
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{planejamento.nome}</Text>
                <View
                  style={[
                    styles.badge,
                    planejamento.status === 'ABERTO'
                      ? styles.badgeOpen
                      : styles.badgeClosed,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {statusLabel[planejamento.status]}
                  </Text>
                </View>
              </View>

              <Text style={styles.typeText}>{tipoLabel[planejamento.tipo]}</Text>
              {planejamento.descricao ? (
                <Text style={styles.description}>{planejamento.descricao}</Text>
              ) : null}

              <View style={styles.metaGrid}>
                <Text style={styles.cardMeta}>
                  Inicio: {formatOptionalDate(planejamento.dataInicio)}
                </Text>
                <Text style={styles.cardMeta}>
                  Fim: {formatOptionalDate(planejamento.dataFim)}
                </Text>
              </View>

              <View style={styles.actions}>
                <GlassButton
                  label="Ver detalhe"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/planejamentos-detail',
                      params: { id: planejamento.id },
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

export default PlanejamentosScreen;

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
  badgeClosed: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
  },
  badgeOpen: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  badgeText: {
    color: FinanceTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  cardMeta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
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
  description: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xs,
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  metaGrid: {
    gap: FinanceTheme.spacing.xxs,
    marginTop: FinanceTheme.spacing.sm,
  },
  typeText: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
});
