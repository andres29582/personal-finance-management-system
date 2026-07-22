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
  cancelAcertoPlanejamento,
  getPlanejamentoById,
  listAcertosPlanejamento,
  listGastosPlanejamento,
  payAcertoPlanejamento,
  reopenAcertoPlanejamento,
  syncAcertosPlanejamento,
} from '../services/planejamentoService';
import {
  AcertoPlanejamento,
  AcertoPlanejamentoStatus,
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

const acertoStatusLabel: Record<AcertoPlanejamentoStatus, string> = {
  CANCELADO: 'Cancelado',
  CONFIRMADO: 'Confirmado',
  PAGO: 'Pago',
  PENDENTE: 'Pendente',
};

type AcertoAction = 'cancel' | 'pay' | 'reopen';

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
  const [acertos, setAcertos] = useState<AcertoPlanejamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [acertosError, setAcertosError] = useState('');
  const [acertosInfo, setAcertosInfo] = useState('');
  const [acertosActionLoading, setAcertosActionLoading] = useState<
    string | null
  >(null);

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
        const [data, gastosData, acertosData] = await Promise.all([
          getPlanejamentoById(planejamentoId),
          listGastosPlanejamento(planejamentoId),
          listAcertosPlanejamento(planejamentoId),
        ]);
        setPlanejamento(data);
        setGastos(gastosData);
        setAcertos(acertosData);
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
  async function refreshAcertos() {
    if (!planejamentoId) {
      return;
    }

    const acertosData = await listAcertosPlanejamento(planejamentoId);
    setAcertos(acertosData);
  }

  async function handleSyncAcertos() {
    if (!planejamentoId) {
      return;
    }

    try {
      setAcertosActionLoading('sync');
      setAcertosError('');
      setAcertosInfo('');

      const acertosSincronizados =
        await syncAcertosPlanejamento(planejamentoId);
      await refreshAcertos();

      setAcertosInfo(
        acertosSincronizados.length
          ? 'Acertos sincronizados com sucesso.'
          : 'Ainda nao ha dados suficientes para gerar acertos. Cadastre gastos e participantes ativos e tente novamente.',
      );
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel sincronizar os acertos.',
      );
      setAcertosError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setAcertosActionLoading(null);
    }
  }

  async function handleAcertoAction(
    acerto: AcertoPlanejamento,
    action: AcertoAction,
  ) {
    if (!planejamentoId) {
      return;
    }

    const actionKey = `${action}:${acerto.id}`;

    try {
      setAcertosActionLoading(actionKey);
      setAcertosError('');
      setAcertosInfo('');

      const actionByType = {
        cancel: cancelAcertoPlanejamento,
        pay: payAcertoPlanejamento,
        reopen: reopenAcertoPlanejamento,
      };
      await actionByType[action](planejamentoId, acerto.id);
      await refreshAcertos();
      setAcertosInfo('Acerto atualizado com sucesso.');
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel atualizar o acerto.',
      );
      setAcertosError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setAcertosActionLoading(null);
    }
  }

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

          <GlassPanel
            title="Acertos"
            subtitle="Pagamentos calculados entre participantes."
            action={
              <GlassButton
                disabled={!!acertosActionLoading}
                label={
                  acertosActionLoading === 'sync'
                    ? 'Sincronizando...'
                    : 'Sincronizar acertos'
                }
                onPress={handleSyncAcertos}
                variant="ghost"
              />
            }
          >
            {acertosError ? (
              <Text style={styles.acertosError}>{acertosError}</Text>
            ) : null}
            {acertosInfo ? (
              <Text style={styles.acertosInfo}>{acertosInfo}</Text>
            ) : null}

            {acertos.length ? (
              acertos.map((acerto) => (
                <AcertoRow
                  key={acerto.id}
                  acerto={acerto}
                  actionLoading={acertosActionLoading}
                  disabled={!!acertosActionLoading}
                  onAction={handleAcertoAction}
                  participantes={participantes}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>
                Nenhum acerto encontrado. Cadastre gastos e participantes ativos
                para calcular os acertos.
              </Text>
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

function AcertoRow({
  acerto,
  actionLoading,
  disabled,
  onAction,
  participantes,
}: {
  acerto: AcertoPlanejamento;
  actionLoading: string | null;
  disabled: boolean;
  onAction: (acerto: AcertoPlanejamento, action: AcertoAction) => void;
  participantes: ParticipantePlanejamento[];
}) {
  const devedor =
    acerto.deParticipante ??
    participantes.find(
      (participante) => participante.id === acerto.deParticipanteId,
    );
  const recebedor =
    acerto.paraParticipante ??
    participantes.find(
      (participante) => participante.id === acerto.paraParticipanteId,
    );
  const devedorNome = devedor?.nome ?? 'Participante devedor';
  const recebedorNome = recebedor?.nome ?? 'Participante recebedor';

  return (
    <View style={styles.settlementRow}>
      <View style={styles.settlementMain}>
        <View style={styles.settlementHeader}>
          <Text style={styles.settlementTitle}>
            {devedorNome} deve pagar {recebedorNome}
          </Text>
          <View
            style={[
              styles.settlementBadge,
              getAcertoBadgeStyle(acerto.status),
            ]}
          >
            <Text style={styles.settlementBadgeText}>
              {acertoStatusLabel[acerto.status]}
            </Text>
          </View>
        </View>

        <Text style={styles.settlementMeta}>Devedor: {devedorNome}</Text>
        <Text style={styles.settlementMeta}>Recebedor: {recebedorNome}</Text>
        {acerto.dataPagamento ? (
          <Text style={styles.settlementMeta}>
            Pago em {formatOptionalDate(acerto.dataPagamento)}
          </Text>
        ) : null}
        {acerto.observacao ? (
          <Text style={styles.settlementMeta}>
            Observacao: {acerto.observacao}
          </Text>
        ) : null}
      </View>

      <View style={styles.settlementSide}>
        <Text style={styles.settlementValue}>
          {formatCents(acerto.valorCentavos)}
        </Text>
        <AcertoActions
          acerto={acerto}
          actionLoading={actionLoading}
          disabled={disabled}
          onAction={onAction}
        />
      </View>
    </View>
  );
}

function AcertoActions({
  acerto,
  actionLoading,
  disabled,
  onAction,
}: {
  acerto: AcertoPlanejamento;
  actionLoading: string | null;
  disabled: boolean;
  onAction: (acerto: AcertoPlanejamento, action: AcertoAction) => void;
}) {
  const payLoading = actionLoading === `pay:${acerto.id}`;
  const cancelLoading = actionLoading === `cancel:${acerto.id}`;
  const reopenLoading = actionLoading === `reopen:${acerto.id}`;

  if (acerto.status === 'PENDENTE') {
    return (
      <View style={styles.settlementActions}>
        <GlassButton
          disabled={disabled}
          label={payLoading ? 'Marcando...' : 'Marcar como pago'}
          onPress={() => onAction(acerto, 'pay')}
          variant="primary"
        />
        <GlassButton
          disabled={disabled}
          label={cancelLoading ? 'Cancelando...' : 'Cancelar'}
          onPress={() => onAction(acerto, 'cancel')}
          variant="danger"
        />
      </View>
    );
  }

  if (acerto.status === 'PAGO') {
    return (
      <View style={styles.settlementActions}>
        <GlassButton
          disabled={disabled}
          label={reopenLoading ? 'Reabrindo...' : 'Reabrir'}
          onPress={() => onAction(acerto, 'reopen')}
          variant="ghost"
        />
      </View>
    );
  }

  return null;
}

function getAcertoBadgeStyle(status: AcertoPlanejamentoStatus) {
  if (status === 'PENDENTE') {
    return styles.settlementBadgePending;
  }

  if (status === 'PAGO' || status === 'CONFIRMADO') {
    return styles.settlementBadgePaid;
  }

  return styles.settlementBadgeCanceled;
}

export default PlanejamentoDetailScreen;

const styles = StyleSheet.create({
  acertosError: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  acertosInfo: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
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
  settlementActions: {
    gap: FinanceTheme.spacing.xs,
    minWidth: 170,
    width: '100%',
  },
  settlementBadge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  settlementBadgeCanceled: {
    backgroundColor: 'rgba(255, 122, 144, 0.10)',
    borderColor: 'rgba(255, 122, 144, 0.34)',
  },
  settlementBadgePaid: {
    backgroundColor: 'rgba(119, 242, 178, 0.14)',
    borderColor: 'rgba(119, 242, 178, 0.42)',
  },
  settlementBadgePending: {
    backgroundColor: 'rgba(255, 209, 102, 0.12)',
    borderColor: 'rgba(255, 209, 102, 0.40)',
  },
  settlementBadgeText: {
    color: FinanceTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  settlementHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
    justifyContent: 'space-between',
  },
  settlementMain: {
    flex: 1,
    minWidth: 0,
  },
  settlementMeta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.xxs,
  },
  settlementRow: {
    alignItems: 'flex-start',
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
    padding: FinanceTheme.spacing.sm,
  },
  settlementSide: {
    alignItems: 'flex-end',
    gap: FinanceTheme.spacing.sm,
    minWidth: 170,
  },
  settlementTitle: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
    minWidth: 180,
  },
  settlementValue: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
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
