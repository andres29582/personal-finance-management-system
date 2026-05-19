import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../styles/financeTheme';

export type FinanceSidebarItem = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  route: string;
};

type FinanceSidebarProps = {
  activeRoute?: string;
  brandLabel?: string;
  compact?: boolean;
  items: FinanceSidebarItem[];
  onNavigate: (route: string) => void;
};

export function FinanceSidebar({
  activeRoute,
  brandLabel = 'Finance',
  compact = false,
  items,
  onNavigate,
}: FinanceSidebarProps) {
  return (
    <View style={[styles.sidebar, compact ? styles.compactSidebar : null]}>
      <View style={[styles.brand, compact ? styles.compactBrand : null]}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons
            color={FinanceTheme.colors.cyan}
            name="finance"
            size={22}
          />
        </View>
        {!compact ? <Text style={styles.brandText}>{brandLabel}</Text> : null}
      </View>

      <ScrollView
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.navList,
          compact ? styles.compactNavList : null,
        ]}
      >
        {items.map((item) => {
          const active = item.route === activeRoute;

          return (
            <Pressable
              key={item.route}
              accessibilityLabel={item.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onNavigate(item.route)}
              style={({ pressed }) => [
                styles.navItem,
                compact ? styles.compactNavItem : null,
                active ? styles.activeNavItem : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <MaterialCommunityIcons
                color={
                  active
                    ? FinanceTheme.colors.cyan
                    : FinanceTheme.colors.textMuted
                }
                name={item.icon}
                size={20}
              />
              {!compact ? (
                <Text
                  style={[styles.navLabel, active ? styles.activeNavLabel : null]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  activeNavItem: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  activeNavLabel: {
    color: FinanceTheme.colors.text,
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.lg,
    paddingHorizontal: FinanceTheme.spacing.xs,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.glassStrong,
    borderColor: FinanceTheme.neon.cyan.borderColor,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  brandText: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
  },
  compactBrand: {
    marginBottom: 0,
    marginRight: FinanceTheme.spacing.sm,
    paddingHorizontal: 0,
  },
  compactNavItem: {
    height: 42,
    width: 42,
  },
  compactNavList: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.xs,
    paddingRight: FinanceTheme.spacing.md,
  },
  compactSidebar: {
    alignItems: 'center',
    borderRadius: FinanceTheme.radius.lg,
    flexDirection: 'row',
    marginBottom: FinanceTheme.spacing.md,
    minHeight: 64,
    padding: FinanceTheme.spacing.sm,
    width: '100%',
  },
  navItem: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    minHeight: 44,
    paddingHorizontal: FinanceTheme.spacing.sm,
  },
  navLabel: {
    color: FinanceTheme.colors.textMuted,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  navList: {
    gap: FinanceTheme.spacing.xs,
    paddingBottom: FinanceTheme.spacing.md,
  },
  pressed: {
    opacity: FinanceTheme.opacity.pressed,
  },
  sidebar: {
    backgroundColor: FinanceTheme.colors.glass,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.xl,
    borderWidth: FinanceTheme.borderWidth.hairline,
    padding: FinanceTheme.spacing.md,
    width: 236,
  },
});
