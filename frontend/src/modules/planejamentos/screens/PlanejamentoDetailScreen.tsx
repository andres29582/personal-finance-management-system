import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassPanel,
  GlassStatusCard,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { formatDate } from '../../../../utils/formatters';
import { getPlanejamentoById } from '../services/planejamentoService';
import {
  Planejamento,
  PlanejamentoStatus,
  PlanejamentoTipo,
} from '../types/planejamento';

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

export function PlanejamentoDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planejamentoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [planejamento, setPlanejamento] = useState<Planejamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadPlanejamento() {
      if (!planejamentoId) {
        setMessage('Planejamento nao informado.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setMessage('');
        const data = await getPlanejamentoById(planejamentoId);
        setPlanejamento(data);
      } catch (error) {
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o planejamento.',
        );
        setMessage(resolvedError.message);

        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadPlanejamento();
  }, [planejamentoId, router]);

  return (
    <FinanceAppShell
      activeRoute="/planejamentos"
      header={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Voltar"
              onPress={() => router.push('/planejamentos' as never)}
              variant="ghost"
            />
          }
          eyebrow="Planejamento compartilhado"
          subtitle="Detalhe inicial do planejamento."
          title={planejamento?.nome ?? 'Detalhe'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando planejamento...</Text>
          </View>
        </GlassPanel>
      ) : null}

      {!loading && message ? (
        <GlassStatusCard
          title="Nao foi possivel carregar o planejamento"
          description={message}
          tone="error"
          actionLabel="Voltar para lista"
          onActionPress={() => router.push('/planejamentos' as never)}
        />
      ) : null}

      {!loading && planejamento ? (
        <GlassPanel title="Dados gerais" accent="cyan">
          <View style={styles.headerRow}>
            <Text style={styles.title}>{planejamento.nome}</Text>
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

          <View style={styles.infoGrid}>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Inicio</Text>
              <Text style={styles.infoValue}>
                {formatOptionalDate(planejamento.dataInicio)}
              </Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Fim</Text>
              <Text style={styles.infoValue}>
                {formatOptionalDate(planejamento.dataFim)}
              </Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Criado em</Text>
              <Text style={styles.infoValue}>
                {formatOptionalDate(planejamento.createdAt)}
              </Text>
            </View>
          </View>
        </GlassPanel>
      ) : null}
    </FinanceAppShell>
  );
}

export default PlanejamentoDetailScreen;

const styles = StyleSheet.create({
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
  description: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.sm,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    justifyContent: 'space-between',
  },
  infoCell: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flex: 1,
    minWidth: 150,
    padding: FinanceTheme.spacing.sm,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    marginTop: FinanceTheme.spacing.md,
  },
  infoLabel: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginTop: FinanceTheme.spacing.xxs,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
  },
  loadingText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  title: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.heading,
    fontWeight: '900',
  },
  typeText: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginTop: FinanceTheme.spacing.xs,
  },
});
