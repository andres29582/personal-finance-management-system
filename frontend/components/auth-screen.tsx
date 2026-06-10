import { ReactNode } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FinanceTheme } from '../src/shared/styles/financeTheme';

type AuthScreenProps = {
  cardMaxWidth?: number;
  children: ReactNode;
  subtitle?: string;
  title: string;
};

export function AuthScreen({
  cardMaxWidth = 520,
  children,
  subtitle,
  title,
}: AuthScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backgroundLayer}>
        <Image
          source={require('../assets/images/img1_login.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <View style={styles.imageOverlay} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          isWide ? styles.containerWide : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.shell, isWide ? styles.shellWide : null]}>
          {isWide ? (
            <View style={styles.brandPanel}>
              <Text style={styles.eyebrow}>FINANCE CONTROL</Text>
              <Text style={styles.brandTitle}>Meu Sistema Financeiro</Text>
              <Text style={styles.brandCopy}>
                Organize contas, metas e previsoes em uma experiencia segura e
                conectada.
              </Text>
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>24/7</Text>
                  <Text style={styles.metricLabel}>acesso</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>LGPD</Text>
                  <Text style={styles.metricLabel}>seguro</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={[styles.card, { maxWidth: cardMaxWidth }]}>
            <Text style={styles.eyebrow}>ACESSO SEGURO</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    height: '100%',
    opacity: 0.28,
    width: '100%',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  brandCopy: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.body,
    lineHeight: 24,
    marginTop: FinanceTheme.spacing.md,
    maxWidth: 380,
  },
  brandPanel: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    padding: FinanceTheme.spacing.xl,
  },
  brandTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.hero,
    fontWeight: '900',
    marginTop: FinanceTheme.spacing.sm,
    maxWidth: 420,
  },
  card: {
    backgroundColor: FinanceTheme.colors.glassStrong,
    borderColor: FinanceTheme.neon.cyan.borderColor,
    borderRadius: FinanceTheme.radius.xl,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.lg,
    paddingVertical: FinanceTheme.spacing.xl,
    width: '100%',
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
  container: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: FinanceTheme.spacing.lg,
    paddingVertical: FinanceTheme.spacing.xl,
  },
  containerWide: {
    paddingHorizontal: FinanceTheme.spacing.xxl,
  },
  eyebrow: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: FinanceTheme.spacing.sm,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: FinanceTheme.colors.background,
    opacity: 0.78,
  },
  metric: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    minWidth: 116,
    padding: FinanceTheme.spacing.md,
  },
  metricLabel: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  metricValue: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.heading,
    fontWeight: '900',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginTop: FinanceTheme.spacing.xl,
  },
  screen: {
    backgroundColor: FinanceTheme.colors.background,
    flex: 1,
    overflow: 'hidden',
  },
  shell: {
    alignItems: 'center',
    width: '100%',
  },
  shellWide: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.xl,
    justifyContent: 'center',
    maxWidth: 1040,
  },
  subtitle: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 20,
    marginBottom: FinanceTheme.spacing.lg,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.title,
    fontWeight: '900',
    marginBottom: FinanceTheme.spacing.sm,
  },
});
