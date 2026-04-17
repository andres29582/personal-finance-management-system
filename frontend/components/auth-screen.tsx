import { ReactNode } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    width: '100%',
    elevation: 4,
  },
  container: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  screen: {
    backgroundColor: '#EAF5E7',
    flex: 1,
    overflow: 'hidden',
  },
  subtitle: {
    color: '#4B5D52',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    color: '#123524',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
});
