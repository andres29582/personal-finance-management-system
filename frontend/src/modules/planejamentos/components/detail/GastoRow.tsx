import { StyleSheet, Text, View } from 'react-native';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { GlassButton } from '../../../../shared/ui';
import {
  GastoPlanejamento,
  GastoPlanejamentoComportamento,
  GastoPlanejamentoStatus,
  ParticipantePlanejamento,
} from '../../types/planejamento';

const gastoComportamentoLabel: Record<GastoPlanejamentoComportamento, string> = {
  EVENTUAL: 'Eventual',
  FIXO: 'Fixo',
  VARIAVEL: 'Variavel',
};

const gastoStatusLabel: Record<GastoPlanejamentoStatus, string> = {
  ATIVO: 'ATIVO',
  CANCELADO: 'CANCELADO',
  PENDENTE_REVISAO: 'PENDENTE_REVISAO',
};

type GastoRowProps = {
  actionLoading: boolean;
  canCancel: boolean;
  canEdit: boolean;
  disabled: boolean;
  gasto: GastoPlanejamento;
  onCancel: (gasto: GastoPlanejamento) => void;
  onEdit: (gasto: GastoPlanejamento) => void;
  participantes: ParticipantePlanejamento[];
};

function formatOptionalDate(date: string | null | undefined) {
  return date ? formatDate(date.slice(0, 10)) : '-';
}

function formatCents(value: number) {
  return formatCurrency(value / 100);
}

export function GastoRow({
  actionLoading,
  canCancel,
  canEdit,
  disabled,
  gasto,
  onCancel,
  onEdit,
  participantes,
}: GastoRowProps) {
  const pagador =
    gasto.pagoPorParticipante ??
    participantes.find(
      (participante) => participante.id === gasto.pagoPorParticipanteId,
    );

  return (
    <View style={styles.expenseRow}>
      <View style={styles.expenseMain}>
        <View style={styles.expenseHeader}>
          <Text style={styles.expenseDescription}>{gasto.descricao}</Text>
          <View
            style={[
              styles.expenseStatusBadge,
              getGastoBadgeStyle(gasto.status),
            ]}
          >
            <Text style={styles.expenseStatusText}>
              {gastoStatusLabel[gasto.status]}
            </Text>
          </View>
        </View>
        <Text style={styles.expenseMeta}>
          {formatOptionalDate(gasto.dataGasto)} -{' '}
          {gastoComportamentoLabel[gasto.comportamento]}
          {gasto.categoria ? ` - ${gasto.categoria}` : ''}
        </Text>
        {pagador ? (
          <Text style={styles.expenseMeta}>Pago por {pagador.nome}</Text>
        ) : null}
      </View>
      <View style={styles.expenseSide}>
        <Text style={styles.expenseValue}>
          {formatCents(gasto.valorCentavos)}
        </Text>
        {canEdit || canCancel ? (
          <View style={styles.expenseActions}>
            {canEdit ? (
              <GlassButton
                disabled={disabled}
                label="Editar"
                onPress={() => onEdit(gasto)}
                variant="ghost"
              />
            ) : null}
            {canCancel ? (
              <GlassButton
                disabled={disabled}
                label={
                  actionLoading ? 'Cancelando gasto...' : 'Cancelar gasto'
                }
                onPress={() => onCancel(gasto)}
                variant="danger"
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function getGastoBadgeStyle(status: GastoPlanejamentoStatus) {
  if (status === 'ATIVO') {
    return styles.expenseStatusActive;
  }

  if (status === 'PENDENTE_REVISAO') {
    return styles.expenseStatusPending;
  }

  return styles.expenseStatusCanceled;
}

const styles = StyleSheet.create({
  expenseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
    justifyContent: 'flex-end',
  },
  expenseDescription: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  expenseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
  },
  expenseMain: {
    flex: 1,
    minWidth: 180,
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
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
    padding: FinanceTheme.spacing.sm,
  },
  expenseSide: {
    alignItems: 'flex-end',
    gap: FinanceTheme.spacing.xs,
  },
  expenseStatusActive: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  expenseStatusBadge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  expenseStatusCanceled: {
    backgroundColor: 'rgba(255, 122, 144, 0.10)',
    borderColor: 'rgba(255, 122, 144, 0.34)',
  },
  expenseStatusPending: {
    backgroundColor: 'rgba(255, 208, 106, 0.12)',
    borderColor: 'rgba(255, 208, 106, 0.38)',
  },
  expenseStatusText: {
    color: FinanceTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  expenseValue: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
});
