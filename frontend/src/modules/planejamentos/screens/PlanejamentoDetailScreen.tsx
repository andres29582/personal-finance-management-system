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
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import {
  getPlanejamentoById,
  listGastosPlanejamento,
} from '../services/planejamentoService';
import {
  GastoPlanejamento,
  GastoPlanejamentoComportamento,
  ParticipantePlanejamento,
  ParticipantePlanejamentoStatus,
  ParticipantePlanejamentoTipo,
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

const participanteTipoLabel: Record<ParticipantePlanejamentoTipo, string> = {
  CONVIDADO: 'Convidado',
  MANUAL: 'Manual',
  VINCULADO: 'Vinculado',
};

const participanteStatusLabel: Record<ParticipantePlanejamentoStatus, string> = {
  ATIVO: 'Ativo',
  PENDENTE: 'Pendente',
  REMOVIDO: 'Removido',
};

const gastoComportamentoLabel: Record<GastoPlanejamentoComportamento, string> = {
  EVENTUAL: 'Eventual',
  FIXO: 'Fixo',
  VARIAVEL: 'Variavel',
};

function formatOptionalDate(date: string | null | undefined) {
  return date ? formatDate(date.slice(0, 10)) : '-';
}

function formatCents(value: number) {
  return formatCurrency(value / 100);
}

function getParticipantes(planejamento: Planejamento | null) {
  return planejamento?.participantes ?? [];
}

export function PlanejamentoDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planejamentoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [planejamento, setPlanejamento] = useState<Planejamento | null>(null);
  const [gastos, setGastos] = useState<GastoPlanejamento[]>([]);
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
        const [data, gastosData] = await Promise.all([
          getPlanejamentoById(planejamentoId),
          listGastosPlanejamento(planejamentoId),
        ]);
        setPlanejamento(data);
        setGastos(gastosData);
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

  const participantes = getParticipantes(planejamento);

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
        <>
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

          <GlassPanel
            title="Participantes"
            subtitle="Pessoas vinculadas a este planejamento."
            action={
              <GlassButton
                label="Adicionar participante"
                onPress={() =>
                  router.push({
                    pathname: '/planejamentos-participante-form',
                    params: { id: planejamento.id },
                  } as never)
                }
                variant="ghost"
              />
            }
          >
            {participantes.length ? (
              participantes.map((participante) => (
                <ParticipanteRow
                  key={participante.id}
                  participante={participante}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>
                Nenhum participante cadastrado.
              </Text>
            )}
          </GlassPanel>

          <GlassPanel
            title="Gastos"
            subtitle="Despesas compartilhadas deste planejamento."
            action={
              <GlassButton
                label="Adicionar gasto"
                onPress={() =>
                  router.push({
                    pathname: '/planejamentos-gasto-form',
                    params: { id: planejamento.id },
                  } as never)
                }
                variant="ghost"
              />
            }
          >
            {gastos.length ? (
              gastos.map((gasto) => (
                <GastoRow
                  key={gasto.id}
                  gasto={gasto}
                  participantes={participantes}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhum gasto cadastrado.</Text>
            )}
          </GlassPanel>
        </>
      ) : null}
    </FinanceAppShell>
  );
}

function ParticipanteRow({
  participante,
}: {
  participante: ParticipantePlanejamento;
}) {
  return (
    <View style={styles.participantRow}>
      <View style={styles.participantAvatar}>
        <Text style={styles.participantInitial}>
          {participante.nome.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{participante.nome}</Text>
        {participante.email ? (
          <Text style={styles.participantEmail}>{participante.email}</Text>
        ) : null}
        <View style={styles.participantBadges}>
          <View style={styles.participantBadge}>
            <Text style={styles.participantBadgeText}>
              {participanteTipoLabel[participante.tipo]}
            </Text>
          </View>
          <View
            style={[
              styles.participantBadge,
              participante.status === 'ATIVO'
                ? styles.participantBadgeActive
                : null,
            ]}
          >
            <Text style={styles.participantBadgeText}>
              {participanteStatusLabel[participante.status]}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function GastoRow({
  gasto,
  participantes,
}: {
  gasto: GastoPlanejamento;
  participantes: ParticipantePlanejamento[];
}) {
  const pagador =
    gasto.pagoPorParticipante ??
    participantes.find(
      (participante) => participante.id === gasto.pagoPorParticipanteId,
    );

  return (
    <View style={styles.expenseRow}>
      <View style={styles.expenseMain}>
        <Text style={styles.expenseDescription}>{gasto.descricao}</Text>
        <Text style={styles.expenseMeta}>
          {formatOptionalDate(gasto.dataGasto)} -{' '}
          {gastoComportamentoLabel[gasto.comportamento]}
          {gasto.categoria ? ` - ${gasto.categoria}` : ''}
        </Text>
        {pagador ? (
          <Text style={styles.expenseMeta}>Pago por {pagador.nome}</Text>
        ) : null}
      </View>
      <Text style={styles.expenseValue}>
        {formatCents(gasto.valorCentavos)}
      </Text>
    </View>
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
  emptyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  expenseDescription: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  expenseMain: {
    flex: 1,
    minWidth: 0,
  },
  expenseMeta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.xxs,
  },
  expenseRow: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
    padding: FinanceTheme.spacing.sm,
  },
  expenseValue: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
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
  participantAvatar: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  participantBadge: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  participantBadgeActive: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  participantBadgeText: {
    color: FinanceTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  participantBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
    marginTop: FinanceTheme.spacing.xs,
  },
  participantEmail: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  participantInfo: {
    flex: 1,
    minWidth: 0,
  },
  participantInitial: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  participantName: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  participantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
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
