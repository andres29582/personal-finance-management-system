import { StyleSheet, Text, View } from 'react-native';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { GlassButton } from '../../../../shared/ui';
import {
  AcertoPlanejamento,
  AcertoPlanejamentoStatus,
  ParticipantePlanejamento,
} from '../../types/planejamento';

const acertoStatusLabel: Record<AcertoPlanejamentoStatus, string> = {
  CANCELADO: 'Cancelado',
  CONFIRMADO: 'Confirmado',
  PAGO: 'Pago',
  PENDENTE: 'Pendente',
};

export type AcertoAction = 'cancel' | 'pay' | 'reopen';

type AcertoRowProps = {
  acerto: AcertoPlanejamento;
  actionLoading: string | null;
  canOperate: boolean;
  disabled: boolean;
  onAction: (acerto: AcertoPlanejamento, action: AcertoAction) => void;
  participantes: ParticipantePlanejamento[];
};

function formatOptionalDate(date: string | null | undefined) {
  return date ? formatDate(date.slice(0, 10)) : '-';
}

function formatCents(value: number) {
  return formatCurrency(value / 100);
}

export function AcertoRow({
  acerto,
  actionLoading,
  canOperate,
  disabled,
  onAction,
  participantes,
}: AcertoRowProps) {
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
          canOperate={canOperate}
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
  canOperate,
  disabled,
  onAction,
}: {
  acerto: AcertoPlanejamento;
  actionLoading: string | null;
  canOperate: boolean;
  disabled: boolean;
  onAction: (acerto: AcertoPlanejamento, action: AcertoAction) => void;
}) {
  const payLoading = actionLoading === `pay:${acerto.id}`;
  const cancelLoading = actionLoading === `cancel:${acerto.id}`;
  const reopenLoading = actionLoading === `reopen:${acerto.id}`;

  if (!canOperate) {
    return null;
  }

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

const styles = StyleSheet.create({
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
});
