import { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { FinanceAccent, FinanceTheme } from '../styles/financeTheme';

type GlassPanelProps = {
  accessibilityLabel?: string;
  accent?: FinanceAccent;
  action?: ReactNode;
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title?: string;
};

export function GlassPanel({
  accessibilityLabel,
  accent = 'mixed',
  action,
  children,
  onPress,
  style,
  subtitle,
  title,
}: GlassPanelProps) {
  const content = (
    <>
      {title || subtitle || action ? (
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.panel,
          accentStyles[accent],
          pressed ? styles.pressed : null,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.panel, accentStyles[accent], style]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  action: {
    marginLeft: FinanceTheme.spacing.sm,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.md,
  },
  panel: {
    backgroundColor: FinanceTheme.colors.glass,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.xl,
    borderWidth: FinanceTheme.borderWidth.hairline,
    marginBottom: FinanceTheme.spacing.md,
    padding: FinanceTheme.spacing.md,
    ...Platform.select({
      web: {
        boxShadow: `0px ${FinanceTheme.shadow.card.offsetY}px ${FinanceTheme.shadow.card.radius}px rgba(125, 249, 255, ${FinanceTheme.shadow.card.opacity})`,
      },
      default: {
        shadowColor: FinanceTheme.shadow.card.color,
        shadowOffset: { width: 0, height: FinanceTheme.shadow.card.offsetY },
        shadowOpacity: FinanceTheme.shadow.card.opacity,
        shadowRadius: FinanceTheme.shadow.card.radius,
        elevation: FinanceTheme.shadow.card.elevation,
      },
    }),
  },
  pressed: {
    opacity: FinanceTheme.opacity.pressed,
  },
  subtitle: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
  },
});

const accentStyles = StyleSheet.create({
  cyan: {
    borderColor: FinanceTheme.neon.cyan.borderColor,
    ...Platform.select({
      web: {},
      default: {
        shadowColor: FinanceTheme.neon.cyan.shadowColor,
      },
    }),
  },
  magenta: {
    borderColor: FinanceTheme.neon.magenta.borderColor,
    ...Platform.select({
      web: {},
      default: {
        shadowColor: FinanceTheme.neon.magenta.shadowColor,
      },
    }),
  },
  mixed: {
    borderColor: FinanceTheme.neon.mixed.borderColor,
    ...Platform.select({
      web: {},
      default: {
        shadowColor: FinanceTheme.neon.mixed.shadowColor,
      },
    }),
  },
});
