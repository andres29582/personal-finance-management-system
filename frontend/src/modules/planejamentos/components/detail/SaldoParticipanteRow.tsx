import { StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '../../../../../utils/formatters';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { SaldoParticipanteResumoFinanceiroPlanejamento } from '../../types/planejamento';

type SaldoParticipanteRowProps = {
  saldoParticipante: SaldoParticipanteResumoFinanceiroPlanejamento;
};

function formatCents(value: number) {
  return formatCurrency(value / 100);
}

export function SaldoParticipanteRow({
  saldoParticipante,
}: SaldoParticipanteRowProps) {
  return (
    <View style={styles.balanceRow}>
      <View style={styles.balanceMain}>
        <Text style={styles.balanceParticipantName}>
          {saldoParticipante.participante.nome}
        </Text>
        <Text style={styles.balanceLabel}>Saldo aberto</Text>
      </View>
      <View style={styles.balanceSide}>
        <Text
          style={[
            styles.balanceValue,
            saldoParticipante.statusFinanceiro === 'DEVEDOR'
              ? styles.balanceValueDebtor
              : null,
          ]}
        >
          {formatCents(saldoParticipante.saldoAbertoCentavos)}
        </Text>
        <View
          style={[
            styles.financialStatusBadge,
            getFinancialStatusBadgeStyle(saldoParticipante.statusFinanceiro),
          ]}
        >
          <Text style={styles.financialStatusText}>
            {saldoParticipante.statusFinanceiro}
          </Text>
        </View>
      </View>
    </View>
  );
}

function getFinancialStatusBadgeStyle(
  status: SaldoParticipanteResumoFinanceiroPlanejamento['statusFinanceiro'],
) {
  if (status === 'DEVEDOR') {
    return styles.financialStatusDebtor;
  }

  if (status === 'RECEBEDOR') {
    return styles.financialStatusReceiver;
  }

  return styles.financialStatusSettled;
}

const styles = StyleSheet.create({
  balanceLabel: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.xxs,
  },
  balanceMain: {
    flex: 1,
    minWidth: 140,
  },
  balanceParticipantName: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  balanceRow: {
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
  balanceSide: {
    alignItems: 'flex-end',
    gap: FinanceTheme.spacing.xs,
  },
  balanceValue: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  balanceValueDebtor: {
    color: FinanceTheme.colors.danger,
  },
  financialStatusBadge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  financialStatusDebtor: {
    backgroundColor: 'rgba(255, 122, 144, 0.10)',
    borderColor: 'rgba(255, 122, 144, 0.34)',
  },
  financialStatusReceiver: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  financialStatusSettled: {
    backgroundColor: 'rgba(119, 242, 178, 0.14)',
    borderColor: 'rgba(119, 242, 178, 0.42)',
  },
  financialStatusText: {
    color: FinanceTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
});
