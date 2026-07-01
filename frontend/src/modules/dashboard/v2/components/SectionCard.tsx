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
import { FinanceAccent, FinanceTheme } from '../../../../shared/styles/financeTheme';

type SectionCardProps = {
  accessibilityLabel?: string;
  accent?: FinanceAccent;
  action?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title?: string;
};

export function SectionCard({
  accessibilityLabel,
  accent = 'mixed',
  action,
  children,
  compact = false,
  onPress,
  style,
  subtitle,
  title,
}: SectionCardProps) {
  const content = (
    <>
      {title || subtitle || action ? (
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            {title ? (
              <Text numberOfLines={2} style={styles.title}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text numberOfLines={2} style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
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
          styles.card,
          accentStyles[accent],
          compact ? styles.compact : null,
          pressed ? styles.pressed : null,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        accentStyles[accent],
        compact ? styles.compact : null,
        style,
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    flexShrink: 0,
    marginLeft: FinanceTheme.spacing.sm,
  },
  card: {
    backgroundColor: FinanceTheme.colors.glass,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.lg,
    borderWidth: FinanceTheme.borderWidth.hairline,
    padding: FinanceTheme.spacing.md,
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 28px rgba(8, 18, 32, 0.28)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
      },
    }),
  },
  compact: {
    padding: FinanceTheme.spacing.sm,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.md,
  },
  pressed: {
    opacity: FinanceTheme.opacity.pressed,
  },
  subtitle: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 18,
    marginTop: FinanceTheme.spacing.xxs,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
  },
});

const accentStyles = StyleSheet.create({
  cyan: {
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  magenta: {
    borderColor: FinanceTheme.neon.magenta.borderColor,
  },
  mixed: {
    borderColor: FinanceTheme.neon.mixed.borderColor,
  },
});
