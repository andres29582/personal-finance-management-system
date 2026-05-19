import { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FinanceLayout,
  getFinanceContentPadding,
  isFinanceDesktop,
} from '../styles/financeLayout';
import { FinanceTheme } from '../styles/financeTheme';
import { FinanceSidebar, FinanceSidebarItem } from './FinanceSidebar';

type FinanceAppShellProps = {
  activeRoute?: string;
  brandLabel?: string;
  children: ReactNode;
  header: ReactNode;
  onNavigate: (route: string) => void;
  sidebarItems: FinanceSidebarItem[];
};

export function FinanceAppShell({
  activeRoute,
  brandLabel,
  children,
  header,
  onNavigate,
  sidebarItems,
}: FinanceAppShellProps) {
  const { width } = useWindowDimensions();
  const desktop = isFinanceDesktop(width);
  const contentPadding = getFinanceContentPadding(width);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundLayer} />
      <View
        style={[
          styles.appFrame,
          desktop ? styles.desktopFrame : styles.mobileFrame,
          { padding: contentPadding },
        ]}
      >
        {desktop ? (
          <FinanceSidebar
            activeRoute={activeRoute}
            brandLabel={brandLabel}
            items={sidebarItems}
            onNavigate={onNavigate}
          />
        ) : null}

        <View style={styles.contentFrame}>
          {!desktop ? (
            <FinanceSidebar
              activeRoute={activeRoute}
              brandLabel={brandLabel}
              compact
              items={sidebarItems}
              onNavigate={onNavigate}
            />
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.contentLimiter}>
              {header}
              {children}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appFrame: {
    flex: 1,
    gap: FinanceTheme.spacing.lg,
  },
  backgroundLayer: {
    backgroundColor: FinanceTheme.colors.background,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  contentFrame: {
    flex: 1,
    minWidth: 0,
  },
  contentLimiter: {
    alignSelf: 'center',
    maxWidth: FinanceLayout.maxContentWidth,
    width: '100%',
  },
  desktopFrame: {
    flexDirection: 'row',
  },
  mobileFrame: {
    flexDirection: 'column',
  },
  safeArea: {
    backgroundColor: FinanceTheme.colors.background,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: FinanceTheme.spacing.xxl,
  },
});
