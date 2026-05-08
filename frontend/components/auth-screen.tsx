import { ReactNode } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContaTheme } from '../constants/contas-theme';

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
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backgroundLayer}>
        <Image
          source={require('../assets/images/img1_login.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { maxWidth: cardMaxWidth }]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    height: '100%',
    opacity: 0.55,
    width: '100%',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: ContaTheme.colors.surface,
    borderRadius: ContaTheme.radius.xl,
    paddingHorizontal: ContaTheme.spacing.lg,
    paddingVertical: ContaTheme.spacing.xl,
    width: '100%',
    ...Platform.select({
      web: {
        boxShadow: `0px ${ContaTheme.shadow.offsetY}px ${ContaTheme.shadow.radius}px rgba(${ContaTheme.shadow.color}, ${ContaTheme.shadow.opacity})`,
      },
      default: {
        shadowColor: ContaTheme.shadow.color,
        shadowOffset: { width: 0, height: ContaTheme.shadow.offsetY },
        shadowOpacity: ContaTheme.shadow.opacity,
        shadowRadius: ContaTheme.shadow.radius,
        elevation: ContaTheme.shadow.elevation,
      },
    }),
  },
  container: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: ContaTheme.spacing.xl,
    paddingVertical: ContaTheme.spacing.xl,
  },
  screen: {
    backgroundColor: ContaTheme.colors.screenBg,
    flex: 1,
    overflow: 'hidden',
  },
  subtitle: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginBottom: ContaTheme.spacing.lg,
    textAlign: 'center',
  },
  title: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.title,
    fontWeight: '700',
    marginBottom: ContaTheme.spacing.sm,
    textAlign: 'center',
  },
});
