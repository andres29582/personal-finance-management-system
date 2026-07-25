import { StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '../../../../../utils/formatters';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { GlassPanel } from '../../../../shared/ui';
import {
  PlanejamentoSituacaoFinanceira,
  ResumoFinanceiroPlanejamento,
} from '../../types/planejamento';
import { SaldoParticipanteRow } from './SaldoParticipanteRow';

const situacaoFinanceiraLabel: Record<
  PlanejamentoSituacaoFinanceira,
  string
> = {
  PENDENTE: 'Pendente',
  QUITADO: 'Quitado',
};

type PlanejamentoFinancialSummarySectionProps = {
  resumo: ResumoFinanceiroPlanejamento;
};

function formatCents(value: number) {
  return formatCurrency(value / 100);
}

export function PlanejamentoFinancialSummarySection({
  resumo,
}: PlanejamentoFinancialSummarySectionProps) {
  return (
    <GlassPanel
      title="Resumo financeiro"
      subtitle="Valores oficiais calculados pelo backend."
      accent="magenta"
    >
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCell}>
          <Text style={styles.infoLabel}>Situacao financeira</Text>
          <Text
            style={[
              styles.summaryValue,
              resumo.situacaoFinanceira === 'QUITADO'
                ? styles.summaryValueSettled
                : styles.summaryValuePending,
            ]}
          >
            {situacaoFinanceiraLabel[resumo.situacaoFinanceira]}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.infoLabel}>Total de gastos ativos</Text>
          <Text style={styles.summaryValue}>
            {formatCents(resumo.totalGastosAtivosCentavos)}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.infoLabel}>Obrigacao residual</Text>
          <Text style={styles.summaryValue}>
            {formatCents(resumo.obrigacaoResidualCentavos)}
          </Text>
        </View>
      </View>

      <Text style={styles.summarySectionTitle}>Saldos por participante</Text>
      {resumo.participantes.length ? (
        resumo.participantes.map((saldoParticipante) => (
          <SaldoParticipanteRow
            key={saldoParticipante.participante.id}
            saldoParticipante={saldoParticipante}
          />
        ))
      ) : (
        <Text style={styles.emptyText}>
          Nenhum participante com dados financeiros.
        </Text>
      )}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  infoLabel: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryCell: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flex: 1,
    minWidth: 180,
    padding: FinanceTheme.spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
  },
  summarySectionTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
    marginBottom: FinanceTheme.spacing.sm,
    marginTop: FinanceTheme.spacing.md,
  },
  summaryValue: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '900',
    marginTop: FinanceTheme.spacing.xs,
  },
  summaryValuePending: {
    color: FinanceTheme.colors.warning,
  },
  summaryValueSettled: {
    color: FinanceTheme.colors.success,
  },
});
