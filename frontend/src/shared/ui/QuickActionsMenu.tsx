import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { FinanceTheme } from '../styles/financeTheme';

export type QuickAction = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  route: string;
};

export type QuickActionGroup = {
  actions: QuickAction[];
  label: 'Registrar' | 'Gestionar' | 'Consultar';
};

export const financeQuickActionGroups: QuickActionGroup[] = [
  {
    label: 'Registrar',
    actions: [
      { icon: 'cash-plus', label: 'Nova receita', route: '/transacoes-form?tipo=receita' },
      { icon: 'cart-minus', label: 'Nova despesa', route: '/transacoes-form?tipo=despesa' },
      { icon: 'bank-transfer', label: 'Transferência', route: '/transferencias-form' },
    ],
  },
  {
    label: 'Gestionar',
    actions: [
      { icon: 'wallet-outline', label: 'Contas', route: '/contas' },
      { icon: 'wallet-plus-outline', label: 'Nova conta', route: '/contas-create' },
      { icon: 'tag-outline', label: 'Categorias', route: '/categorias' },
      { icon: 'tag-plus-outline', label: 'Nova categoria', route: '/categorias-form' },
      { icon: 'bank-transfer', label: 'Transferências', route: '/transferencias' },
      { icon: 'cash-multiple', label: 'Orçamentos', route: '/orcamentos' },
      { icon: 'cash-multiple', label: 'Novo orçamento', route: '/orcamentos-form' },
      { icon: 'bullseye-arrow', label: 'Metas', route: '/metas' },
      { icon: 'bullseye-arrow', label: 'Nova meta', route: '/metas-form' },
      { icon: 'receipt-text-outline', label: 'Dívidas', route: '/dividas' },
      { icon: 'receipt-text-plus-outline', label: 'Nova dívida', route: '/dividas-form' },
      { icon: 'bell-outline', label: 'Alertas', route: '/alertas' },
      { icon: 'bell-plus-outline', label: 'Novo alerta', route: '/alertas-form' },
    ],
  },
  {
    label: 'Consultar',
    actions: [
      { icon: 'format-list-bulleted', label: 'Transações', route: '/transacoes' },
      { icon: 'chart-box-outline', label: 'Relatórios', route: '/relatorios' },
    ],
  },
];

export const financeQuickActions = financeQuickActionGroups.flatMap(
  ({ actions }) => actions,
);

type QuickActionsMenuProps = {
  onNavigate: (route: string) => void;
};

export function QuickActionsMenu({ onNavigate }: QuickActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<View>(null);
  const entry = useRef<View>(null);
  const mounted = useRef(true);
  const navigating = useRef(false);
  const returnFocus = useRef(false);
  const presentation = useRef({ open, version: 0 });
  if (presentation.current.open !== open) {
    presentation.current.open = open;
    if (open) presentation.current.version++;
  }
  const version = presentation.current.version;
  function restoreTriggerFocus(expectedVersion = version) {
    if (
      mounted.current &&
      !navigating.current &&
      returnFocus.current &&
      !presentation.current.open &&
      presentation.current.version === expectedVersion &&
      Platform.OS !== 'web' &&
      trigger.current
    ) {
      AccessibilityInfo.sendAccessibilityEvent(trigger.current, 'focus');
      returnFocus.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (open || !returnFocus.current || Platform.OS !== 'android') return;
    const frame = requestAnimationFrame(() => {
      restoreTriggerFocus(version);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, version]);
  const close = () => {
    returnFocus.current = true;
    setOpen(false);
  };
  const [progress] = useState(() => new Animated.Value(0));
  const insets = useContext(SafeAreaInsetsContext);
  const reducedMotion = useReducedMotion();
  const bottomOffset = insets?.bottom ?? 0;

  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || reducedMotion) {
      progress.setValue(open ? 1 : 0);
      return;
    }

    Animated.timing(progress, {
      duration: open ? 320 : 180,
      toValue: open ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [open, progress, reducedMotion]);

  const navigate = (route: string) => {
    navigating.current = true;
    returnFocus.current = false;
    setOpen(false);
    progress.setValue(0);
    onNavigate(route);
  };

  function renderFab(overlay: boolean) {
    return (
      <Animated.View
        style={[
          styles.fabPosition,
          {
            bottom: 62 + bottomOffset,
            transform: [
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '45deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable
          ref={overlay ? undefined : trigger}
          accessibilityLabel={
            overlay ? 'Fechar ações rápidas' : 'Abrir ações rápidas'
          }
          accessibilityRole="button"
          accessibilityState={{ expanded: overlay }}
          onPress={
            overlay
              ? close
              : () => {
                  navigating.current = false;
                  returnFocus.current = false;
                  setOpen(true);
                }
          }
          style={({ pressed }) => [
            styles.fab,
            pressed ? styles.fabPressed : null,
          ]}
        >
          <View
            pointerEvents="none"
            style={[styles.fabBlob, styles.fabBlobLeft]}
          />
          <View
            pointerEvents="none"
            style={[styles.fabBlob, styles.fabBlobRight]}
          />
          <MaterialCommunityIcons
            color={FinanceTheme.colors.abyss[950]}
            name="plus"
            size={30}
          />
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Modal
        key={version}
        transparent
        visible={open}
        animationType="none"
        onRequestClose={close}
        onAccessibilityEscape={close}
        onDismiss={() => {
          if (Platform.OS === 'ios') restoreTriggerFocus(version);
        }}
        onShow={() => {
          if (
            presentation.current.open &&
            presentation.current.version === version &&
            Platform.OS !== 'web' &&
            mounted.current &&
            !navigating.current &&
            entry.current
          )
            AccessibilityInfo.sendAccessibilityEvent(entry.current, 'focus');
        }}
      >
        <View
          style={StyleSheet.absoluteFill}
          accessibilityViewIsModal
          onAccessibilityEscape={close}
        >
          <Pressable
            accessibilityLabel="Fechar ações rápidas"
            accessibilityRole="button"
            onPress={close}
            style={styles.backdrop}
          />

          <Animated.View
            accessibilityElementsHidden={!open}
            importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              styles.menu,
              {
                bottom: 132 + bottomOffset,
                opacity: progress,
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text accessibilityRole="header" style={styles.menuTitle}>
              Ações rápidas
            </Text>
            <ScrollView
              contentContainerStyle={styles.actionList}
              showsVerticalScrollIndicator={false}
            >
              {financeQuickActionGroups.map((group) => (
                <View key={group.label} style={styles.actionGroup}>
                  <Text accessibilityRole="header" style={styles.groupTitle}>
                    {group.label}
                  </Text>
                  {group.actions.map((action) => {
                    const index = financeQuickActions.indexOf(action);
                    const start = (index / financeQuickActions.length) * 0.62;
                    const end = Math.min(start + 0.32, 1);

                    return (
                      <Animated.View
                        key={action.label}
                        style={{
                          opacity: progress.interpolate({
                            inputRange: [start, end],
                            outputRange: [0, 1],
                            extrapolate: 'clamp',
                          }),
                          transform: [
                            {
                              translateY: progress.interpolate({
                                inputRange: [start, end],
                                outputRange: [10, 0],
                                extrapolate: 'clamp',
                              }),
                            },
                          ],
                        }}
                      >
                        <Pressable
                          ref={
                            action === financeQuickActions[0]
                              ? entry
                              : undefined
                          }
                          accessibilityLabel={action.label}
                          accessibilityRole="button"
                          onPress={() => navigate(action.route)}
                          style={({ pressed }) => [
                            styles.action,
                            pressed ? styles.pressed : null,
                          ]}
                        >
                          <View style={styles.actionIcon}>
                            <MaterialCommunityIcons
                              color={FinanceTheme.colors.aquateal[400]}
                              name={action.icon}
                              size={20}
                            />
                          </View>
                          <Text style={styles.actionLabel}>{action.label}</Text>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Animated.View>

          {renderFab(true)}
        </View>
      </Modal>
      <View
        accessibilityElementsHidden={open}
        importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
        pointerEvents={open ? 'none' : 'box-none'}
        style={StyleSheet.absoluteFill}
      >
        {renderFab(false)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    minHeight: 48,
    paddingHorizontal: FinanceTheme.spacing.sm,
  },
  actionGroup: {
    gap: FinanceTheme.spacing.xs,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 210, 180, 0.12)',
    borderRadius: FinanceTheme.radius.sm,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  actionLabel: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  actionList: {
    gap: FinanceTheme.spacing.xs,
    paddingBottom: FinanceTheme.spacing.xs,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 13, 16, 0.72)',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.aquateal[400],
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 30,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: FinanceTheme.shadow.buttonGlow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: FinanceTheme.shadow.buttonGlow.opacity,
    shadowRadius: FinanceTheme.shadow.buttonGlow.radius,
    width: 60,
    elevation: FinanceTheme.shadow.buttonGlow.elevation,
  },
  fabBlob: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 20,
    height: 30,
    position: 'absolute',
    width: 34,
  },
  fabBlobLeft: { left: -8, top: 4, transform: [{ rotate: '-18deg' }] },
  fabBlobRight: { bottom: -8, right: -6, transform: [{ rotate: '22deg' }] },
  fabPosition: {
    alignSelf: 'center',
    bottom: 62,
    position: 'absolute',
  },
  groupTitle: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '800',
    marginTop: FinanceTheme.spacing.xs,
    textTransform: 'uppercase',
  },
  fabPressed: { opacity: FinanceTheme.opacity.pressed, transform: [{ scale: 0.96 }] },
  menu: {
    alignSelf: 'center',
    backgroundColor: 'rgba(7, 30, 34, 0.97)',
    borderColor: FinanceTheme.colors.phthaloBorder,
    borderRadius: FinanceTheme.radius.xl,
    borderWidth: 1,
    bottom: 132,
    maxHeight: 410,
    maxWidth: 420,
    padding: FinanceTheme.spacing.md,
    position: 'absolute',
    width: '92%',
  },
  menuTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.heading,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  pressed: { opacity: FinanceTheme.opacity.pressed },
});
