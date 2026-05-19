import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { DashboardAccent, DashboardTheme } from '../styles/dashboardTheme';
import { GlassPanel } from './GlassPanel';

type MetricGlassCardProps = {
  accent?: DashboardAccent;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
};

export function MetricGlassCard({
  accent = 'mixed',
  icon,
  label,
  value,
}: MetricGlassCardProps) {
  return (
    <GlassPanel accent={accent} style={styles.card}>
      <View style={styles.content}>
        <View style={[styles.iconBox, iconAccentStyles[accent]]}>
          <MaterialCommunityIcons
            color={
              accent === 'magenta'
                ? DashboardTheme.colors.magenta
                : DashboardTheme.colors.cyan
            }
            name={icon}
            size={22}
          />
        </View>
        <View style={styles.textGroup}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: 220,
    flex: 1,
    minHeight: 118,
    minWidth: 220,
  },
  content: {
    flex: 1,
    gap: DashboardTheme.spacing.md,
    justifyContent: 'space-between',
  },
  iconBox: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: DashboardTheme.radius.md,
    borderWidth: DashboardTheme.borderWidth.hairline,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  label: {
    color: DashboardTheme.colors.textMuted,
    fontSize: DashboardTheme.typography.caption,
    fontWeight: '700',
  },
  textGroup: {
    gap: DashboardTheme.spacing.xxs,
  },
  value: {
    color: DashboardTheme.colors.text,
    fontSize: DashboardTheme.typography.heading,
    fontWeight: '900',
  },
});

const iconAccentStyles = StyleSheet.create({
  cyan: {
    backgroundColor: DashboardTheme.colors.cyanSoft,
    borderColor: DashboardTheme.neon.cyan.borderColor,
  },
  magenta: {
    backgroundColor: DashboardTheme.colors.magentaSoft,
    borderColor: DashboardTheme.neon.magenta.borderColor,
  },
  mixed: {
    backgroundColor: DashboardTheme.colors.glassSubtle,
    borderColor: DashboardTheme.colors.borderStrong,
  },
});
