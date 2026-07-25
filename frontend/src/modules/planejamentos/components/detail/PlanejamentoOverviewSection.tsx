import { StyleSheet, Text, View } from 'react-native';
import { formatDate } from '../../../../../utils/formatters';
import { FinanceTheme } from '../../../../shared/styles/financeTheme';
import { GlassPanel } from '../../../../shared/ui';
import {
  Planejamento,
  PlanejamentoStatus,
  PlanejamentoTipo,
} from '../../types/planejamento';

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

type PlanejamentoOverviewSectionProps = {
  planejamento: Planejamento;
};

function formatOptionalDate(date: string | null | undefined) {
  return date ? formatDate(date.slice(0, 10)) : '-';
}

export function PlanejamentoOverviewSection({
  planejamento,
}: PlanejamentoOverviewSectionProps) {
  return (
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
  );
}

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
