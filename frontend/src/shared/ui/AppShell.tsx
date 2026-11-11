import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode, useContext } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { FinanceLayout, getFinanceContentPadding } from '../styles/financeLayout';
import { FinanceTheme } from '../styles/financeTheme';
import { QuickActionsMenu } from './QuickActionsMenu';

const bottomItems = [
  { icon: 'view-dashboard-outline', label: 'Dashboard', route: '/dashboard' },
  { icon: 'account-group-outline', label: 'Planejamentos', route: '/planejamentos' },
  { icon: 'chart-timeline-variant', label: 'Previsão ML', route: '/previsao-deficit' },
  { icon: 'lightbulb-on-outline', label: 'Decisões', route: '/decisoes' },
] as const;

type AppShellProps = {
  activeRoute: string;
  children: ReactNode;
  keyboardAvoiding?: boolean;
  onLogout?: () => void;
  onProfilePress?: () => void;
  onRefresh?: () => Promise<void> | void;
  pageHeader?: ReactNode;
  profileDetail?: string;
  profileLabel?: string;
  refreshing?: boolean;
};

export function AppShell({
  activeRoute,
  children,
  keyboardAvoiding = true,
  onLogout,
  onProfilePress,
  onRefresh,
  pageHeader,
  profileDetail,
  profileLabel = 'Perfil',
  refreshing = false,
}: AppShellProps) {
  const router = useRouter();
  const insets = useContext(SafeAreaInsetsContext);
  const bottomInset = insets?.bottom ?? 0;
  const isKeyboardVisible = useKeyboardVisible();
  const { width } = useWindowDimensions();
  const isPhone = width < FinanceLayout.breakpoints.tabletMin;
  const contentPadding = getFinanceContentPadding(width);
  const contentMaxWidth = isPhone ? 430 : FinanceLayout.maxContentWidth;
  const navigate = (route: string) => router.push(route as never);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.ambientGlowTop} />
      <View style={styles.ambientGlowBottom} />

      <View style={[styles.appHeader, isPhone ? styles.appHeaderPhone : null]}>
        <Pressable
          accessibilityLabel="Ir para o Dashboard"
          accessibilityRole="button"
          onPress={() => navigate('/dashboard')}
          style={({ pressed }) => [styles.brand, pressed ? styles.pressed : null]}
        >
          <Text style={styles.brandBase}>AEPV</Text>
          <Text style={styles.brandAccent}>.ia.finance</Text>
        </Pressable>

        <View style={styles.profileArea}>
          <Pressable
            accessibilityLabel="Abrir perfil do usuário"
            accessibilityRole="button"
            onPress={onProfilePress}
            style={({ pressed }) => [
              styles.profileButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.avatar}>
              <MaterialCommunityIcons
                color={FinanceTheme.colors.aquateal[400]}
                name="account-outline"
                size={20}
              />
            </View>
            <View style={[styles.profileCopy, isPhone ? styles.profileCopyPhone : null]}>
              <Text numberOfLines={1} style={styles.profileLabel}>{profileLabel}</Text>
              {profileDetail ? (
                <Text numberOfLines={1} style={styles.profileDetail}>{profileDetail}</Text>
              ) : null}
            </View>
          </Pressable>
          {onLogout ? (
            <Pressable
              accessibilityLabel="Sair da conta"
              accessibilityRole="button"
              onPress={onLogout}
              style={({ pressed }) => [styles.logout, pressed ? styles.pressed : null]}
            >
              <MaterialCommunityIcons color={FinanceTheme.colors.danger} name="logout" size={20} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={keyboardAvoiding}
        style={styles.keyboardAvoider}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: contentPadding,
              paddingTop: isPhone ? FinanceTheme.spacing.md : FinanceTheme.spacing.lg,
              paddingBottom: isKeyboardVisible
                ? FinanceTheme.spacing.xl
                : 92 + bottomInset,
            },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                colors={[FinanceTheme.colors.aquateal[400], FinanceTheme.colors.cyan]}
                onRefresh={onRefresh}
                progressBackgroundColor={FinanceTheme.colors.backgroundElevated}
                refreshing={Boolean(refreshing)}
                tintColor={FinanceTheme.colors.aquateal[400]}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.contentLimiter, { maxWidth: contentMaxWidth }]}>
            {pageHeader}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {!isKeyboardVisible ? (
        <>
          <View
            accessibilityRole="tablist"
            style={[
              styles.bottomNavigation,
              { marginBottom: bottomInset > 0 ? bottomInset : FinanceTheme.spacing.xs },
            ]}
          >
            {bottomItems.map((item) => {
              const active = activeRoute === item.route;
              return (
                <Pressable
                  key={item.route}
                  accessibilityLabel={item.label}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => navigate(item.route)}
                  style={({ pressed }) => [
                    styles.bottomItem,
                    active ? styles.bottomItemActive : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <MaterialCommunityIcons
                    color={active ? FinanceTheme.colors.aquateal[400] : FinanceTheme.colors.textSubtle}
                    name={item.icon}
                    size={21}
                  />
                  <Text numberOfLines={1} style={[styles.bottomLabel, active ? styles.bottomLabelActive : null]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <QuickActionsMenu onNavigate={navigate} />
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ambientGlowBottom: {
    backgroundColor: 'rgba(0, 210, 180, 0.08)',
    borderRadius: 180,
    bottom: -100,
    height: 280,
    position: 'absolute',
    right: -100,
    width: 280,
  },
  ambientGlowTop: {
    backgroundColor: 'rgba(0, 77, 122, 0.18)',
    borderRadius: 180,
    height: 300,
    left: -140,
    position: 'absolute',
    top: -160,
    width: 300,
  },
  appHeader: {
    alignItems: 'center',
    borderBottomColor: FinanceTheme.colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: FinanceTheme.spacing.md,
  },
  appHeaderPhone: { paddingHorizontal: FinanceTheme.spacing.sm },
  avatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 210, 180, 0.1)',
    borderColor: FinanceTheme.colors.phthaloBorder,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  bottomItem: {
    alignItems: 'center',
    borderRadius: FinanceTheme.radius.md,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 2,
  },
  bottomItemActive: { backgroundColor: 'rgba(0, 210, 180, 0.1)' },
  bottomLabel: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
  },
  bottomLabelActive: { color: FinanceTheme.colors.aquateal[400] },
  bottomNavigation: {
    alignItems: 'center',
    backgroundColor: 'rgba(4, 25, 27, 0.96)',
    borderColor: FinanceTheme.colors.phthaloBorder,
    borderRadius: FinanceTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    marginHorizontal: FinanceTheme.spacing.sm,
    minHeight: 62,
    paddingHorizontal: FinanceTheme.spacing.xs,
  },
  brand: { alignItems: 'baseline', flexDirection: 'row' },
  brandAccent: {
    color: FinanceTheme.colors.aquateal[400],
    fontSize: 17,
    fontWeight: '800',
  },
  brandBase: {
    color: FinanceTheme.colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  contentLimiter: {
    alignSelf: 'center',
    width: '100%',
  },
  logout: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressed: { opacity: FinanceTheme.opacity.pressed },
  profileArea: { alignItems: 'center', flexDirection: 'row' },
  profileButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.xs,
    minHeight: 44,
  },
  profileCopy: { flexShrink: 1, maxWidth: 150 },
  profileCopyPhone: { maxWidth: 112 },
  profileDetail: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.micro,
  },
  profileLabel: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  keyboardAvoider: { flex: 1, width: '100%' },
  safeArea: { backgroundColor: FinanceTheme.colors.background, flex: 1 },
  scrollContent: { paddingBottom: 92 },
});
