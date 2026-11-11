import { ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
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
  brandAccent?: string;
  brandName?: string;
  cardMaxWidth?: number;
  children: ReactNode;
  focalElement?: ReactNode;
  showBrandHeader?: boolean;
  subtitle?: string;
  title: string;
  titleOutsideCard?: boolean;
};

export function AuthScreen({
  brandAccent = '.ia.finance',
  brandName = 'AEPV',
  cardMaxWidth = 520,
  children,
  focalElement,
  showBrandHeader = true,
  subtitle,
  title,
  titleOutsideCard = false,
}: AuthScreenProps) {
  const { height, width } = useWindowDimensions();
  const isWide = width >= 860;
  const isCompact = height < 740;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backgroundLayer}>
        <Image
          source={require('../assets/images/img1_login.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <View style={styles.imageOverlay} />
        <View style={[styles.ambientGlow, styles.ambientGlowTopLeft]} />
        <View style={[styles.ambientGlow, styles.ambientGlowTopRight]} />
        <View style={[styles.ambientGlow, styles.ambientGlowBottom]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: 'height' })}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            isWide ? styles.containerWide : null,
            isCompact ? styles.containerCompact : null,
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
        {showBrandHeader ? (
          <View accessibilityRole="header" style={styles.topBar}>
            <View style={styles.logoRow}>
              <Text accessibilityRole="text" style={styles.logoText}>
                {brandName}
                <Text style={styles.logoTextAccent}>{brandAccent}</Text>
              </Text>
            </View>
          </View>
        ) : null}

        {titleOutsideCard ? (
          <View style={[styles.introRow, { maxWidth: cardMaxWidth }]}>
            {focalElement}
            <View style={styles.introCopy}>
              <Text accessibilityRole="header" style={styles.titleOutside}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitleOutside}>{subtitle}</Text>
              ) : null}
            </View>
          </View>
        ) : focalElement ? (
          <View
            style={[
              styles.focalContainer,
              isCompact ? styles.focalContainerCompact : null,
            ]}
          >
            {focalElement}
          </View>
        ) : null}

        <View style={styles.shell}>
          <View
            style={[
              styles.card,
              isCompact ? styles.cardCompact : null,
              titleOutsideCard ? styles.cardWithoutTitle : null,
              { maxWidth: cardMaxWidth },
            ]}
          >
            <View pointerEvents="none" style={styles.cardSurface} />
            <View pointerEvents="none" style={styles.cardTopHighlight} />
            <View pointerEvents="none" style={styles.cardBottomGlow} />
            {!titleOutsideCard ? (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </>
            ) : null}
            {children}
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ambientGlow: {
    borderRadius: 999,
    position: 'absolute',
  },
  ambientGlowBottom: {
    backgroundColor: 'rgba(0, 210, 180, 0.1)',
    bottom: -100,
    height: 300,
    right: -120,
    width: 300,
  },
  ambientGlowTopLeft: {
    backgroundColor: 'rgba(0, 77, 122, 0.2)',
    height: 280,
    left: -120,
    top: -110,
    width: 280,
  },
  ambientGlowTopRight: {
    backgroundColor: 'rgba(0, 210, 180, 0.1)',
    height: 230,
    right: -100,
    top: -70,
    width: 230,
  },
  backgroundImage: {
    height: '100%',
    opacity: 0.28,
    width: '100%',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    backgroundColor: 'rgba(4, 25, 27, 0.76)',
    borderColor: 'rgba(255, 255, 255, 0.26)',
    borderRadius: FinanceTheme.radius.xl,
    borderWidth: 1,
    paddingHorizontal: FinanceTheme.spacing.lg,
    paddingVertical: FinanceTheme.spacing.xl,
    width: '100%',
    ...Platform.select({
      web: {
        boxShadow:
          '0 20px 45px -10px rgba(0, 15, 20, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.18), inset 0 -1px 2px rgba(0, 210, 180, 0.15)',
      },
      default: {
        shadowColor: '#000f14',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.58,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  cardBottomGlow: {
    backgroundColor: 'rgba(0, 210, 180, 0.16)',
    bottom: 1,
    height: 1,
    left: 18,
    position: 'absolute',
    right: 18,
  },
  cardCompact: {
    paddingHorizontal: FinanceTheme.spacing.md,
    paddingVertical: FinanceTheme.spacing.lg,
  },
  cardSurface: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 56, 101, 0.08)',
    borderRadius: FinanceTheme.radius.xl,
  },
  cardTopHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    height: 1,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 1,
  },
  cardWithoutTitle: {
    paddingVertical: 20,
  },
  focalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: FinanceTheme.spacing.md,
    width: '100%',
  },
  focalContainerCompact: {
    marginBottom: FinanceTheme.spacing.sm,
  },
  introCopy: {
    flex: 1,
    minWidth: 0,
  },
  introRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.md,
    marginBottom: FinanceTheme.spacing.sm,
    paddingHorizontal: FinanceTheme.spacing.xs,
    width: '100%',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.md,
    maxWidth: 520,
    paddingHorizontal: FinanceTheme.spacing.xs,
    width: '100%',
  },
  logoRow: {
    alignItems: 'center',
  },
  logoText: {
    color: FinanceTheme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  logoTextAccent: {
    color: FinanceTheme.colors.aquateal[400],
    fontWeight: '800',
  },
  container: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: FinanceTheme.spacing.lg,
    paddingVertical: FinanceTheme.spacing.xl,
  },
  containerCompact: {
    justifyContent: 'flex-start',
    paddingHorizontal: FinanceTheme.spacing.md,
    paddingVertical: FinanceTheme.spacing.md,
  },
  containerWide: {
    paddingHorizontal: FinanceTheme.spacing.xxl,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FinanceTheme.colors.background,
    opacity: 0.78,
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
  subtitle: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 20,
    marginBottom: FinanceTheme.spacing.lg,
  },
  subtitleOutside: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 18,
    marginTop: FinanceTheme.spacing.xxs,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.title,
    fontWeight: '900',
    marginBottom: FinanceTheme.spacing.sm,
  },
  titleOutside: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.title,
    fontWeight: '900',
  },
});
