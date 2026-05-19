import { useState } from 'react';
import { DimensionValue, StyleSheet, Text, View } from 'react-native';
import { DashboardTheme } from '../styles/dashboardTheme';
import { DashboardCategoryBarItem } from '../utils/dashboardMappers';
import { GlassPanel } from './GlassPanel';
import { NeonIconButton } from './NeonIconButton';

type CategoryBarsCardProps = {
  items: DashboardCategoryBarItem[];
  onOpenHistory: () => void;
};

export function CategoryBarsCard({ items, onOpenHistory }: CategoryBarsCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <GlassPanel
      accessibilityLabel="Alternar gastos por categoria"
      accent="magenta"
      title="Gastos por categoria"
      onPress={() => setExpanded((current) => !current)}
      action={
        <View style={styles.actions}>
          <NeonIconButton
            accent="magenta"
            icon="history"
            label="Historico categorias"
            onPress={onOpenHistory}
          />
        </View>
      }
    >
      {expanded ? (
        items.length ? (
          items.map((item) => {
            const width: DimensionValue = `${item.widthPercent}%`;

            return (
              <View key={item.categoriaId} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.label}>{item.categoriaNome}</Text>
                  <Text style={styles.value}>
                    {item.totalFormatado} ({item.percentual}%)
                  </Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width }]} />
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>
            Nenhuma despesa registrada neste mes.
          </Text>
        )
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DashboardTheme.spacing.xs,
    justifyContent: 'flex-end',
  },
  emptyText: {
    color: DashboardTheme.colors.textMuted,
    fontSize: DashboardTheme.typography.body,
  },
  fill: {
    backgroundColor: DashboardTheme.colors.magenta,
    borderRadius: DashboardTheme.radius.xs,
    height: '100%',
    minWidth: 8,
  },
  label: {
    color: DashboardTheme.colors.text,
    flex: 1,
    fontSize: DashboardTheme.typography.body,
    fontWeight: '700',
  },
  row: {
    gap: DashboardTheme.spacing.xs,
    paddingVertical: DashboardTheme.spacing.sm,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DashboardTheme.spacing.sm,
    justifyContent: 'space-between',
  },
  track: {
    backgroundColor: DashboardTheme.colors.glassSubtle,
    borderRadius: DashboardTheme.radius.xs,
    height: 8,
    overflow: 'hidden',
  },
  value: {
    color: DashboardTheme.colors.cyanMuted,
    fontSize: DashboardTheme.typography.caption,
    fontWeight: '800',
    textAlign: 'right',
  },
});
