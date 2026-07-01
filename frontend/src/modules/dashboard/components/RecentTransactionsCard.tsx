import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import { DashboardTransacaoRecente } from '../types/dashboard';
import { DashboardTheme } from '../styles/dashboardTheme';
import { NeonIconButton } from './NeonIconButton';
import { EmptyState, SectionCard } from '../v2/components';

type RecentTransactionsCardProps = {
  items: DashboardTransacaoRecente[];
  onOpenHistory: () => void;
};

export function RecentTransactionsCard({
  items,
  onOpenHistory,
}: RecentTransactionsCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <SectionCard
      accessibilityLabel="Alternar ultimas transacoes"
      accent="cyan"
      title="Ultimas transacoes"
      onPress={() => setExpanded((current) => !current)}
      action={
        <View style={styles.actions}>
          <NeonIconButton
            accent="cyan"
            icon="history"
            label="Historico transacoes"
            onPress={onOpenHistory}
          />
        </View>
      }
    >
      {expanded ? (
        items.length ? (
          items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.label} numberOfLines={1}>
                  {item.descricao || item.categoriaNome}
                </Text>
                <Text style={styles.value}>{formatCurrency(item.valor)}</Text>
              </View>
              <Text style={styles.meta}>
                {item.contaNome} - {formatDate(item.data)}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState
            description="As ultimas receitas, despesas e transferencias aparecem aqui."
            framed={false}
            icon="receipt-text-clock-outline"
            title="Sem transacoes recentes."
          />
        )
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DashboardTheme.spacing.xs,
    justifyContent: 'flex-end',
  },
  item: {
    borderBottomColor: DashboardTheme.colors.border,
    borderBottomWidth: 1,
    paddingVertical: DashboardTheme.spacing.sm,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DashboardTheme.spacing.sm,
    justifyContent: 'space-between',
  },
  label: {
    color: DashboardTheme.colors.text,
    flex: 1,
    fontSize: DashboardTheme.typography.body,
    fontWeight: '700',
  },
  meta: {
    color: DashboardTheme.colors.textSubtle,
    fontSize: DashboardTheme.typography.caption,
    marginTop: DashboardTheme.spacing.xxs,
  },
  value: {
    color: DashboardTheme.colors.cyanMuted,
    fontSize: DashboardTheme.typography.body,
    fontWeight: '800',
  },
});
