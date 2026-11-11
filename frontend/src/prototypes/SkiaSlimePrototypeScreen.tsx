import {
  BlurMask,
  Canvas,
  Circle,
  LinearGradient,
  Oval,
  vec,
} from '@shopify/react-native-skia';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from '../shared/hooks/useReducedMotion';

const SIZE = 240;
const GRADIENT_START = vec(55, 35);
const GRADIENT_END = vec(180, 190);
const COLORS = ['#5ffbd6', '#00d2b4', '#005c8a'];

export function SkiaSlimePrototypeScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);

    if (process.env.NODE_ENV === 'test' || reducedMotion) {
      progress.value = 0.28;
      return;
    }

    progress.value = withRepeat(
      withTiming(1, {
        duration: 2400,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );

    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);

  const bodyRadius = useDerivedValue(
    () => 49 + Math.sin(progress.value * Math.PI * 2) * 4,
  );
  const bodyY = useDerivedValue(
    () => 130 - Math.sin(progress.value * Math.PI * 2) * 3,
  );
  const bodyOpacity = useDerivedValue(
    () => 0.92 + Math.sin(progress.value * Math.PI * 2) * 0.08,
  );

  const firstPhase = useDerivedValue(() => progress.value);
  const firstY = useDerivedValue(() => 112 - firstPhase.value * 78);
  const firstRadius = useDerivedValue(() => {
    const phase = firstPhase.value;
    return phase < 0.2 ? 9 + phase * 30 : 15 - (phase - 0.2) * 9;
  });
  const firstOpacity = useDerivedValue(() => {
    const phase = firstPhase.value;
    if (phase < 0.1) return phase * 10;
    if (phase > 0.82) return (1 - phase) / 0.18;
    return 1;
  });

  const secondPhase = useDerivedValue(() => (progress.value + 0.52) % 1);
  const secondY = useDerivedValue(() => 118 - secondPhase.value * 66);
  const secondRadius = useDerivedValue(() => {
    const phase = secondPhase.value;
    return phase < 0.2 ? 7 + phase * 25 : 12 - (phase - 0.2) * 7;
  });
  const secondOpacity = useDerivedValue(() => {
    const phase = secondPhase.value;
    if (phase < 0.1) return phase * 9;
    if (phase > 0.82) return (1 - phase) / 0.18;
    return 0.9;
  });

  return (
    <SafeAreaView style={styles.screen}>
      <Pressable
        accessibilityLabel="Voltar ao login"
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => router.replace('/login')}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← Voltar</Text>
      </Pressable>

      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Protótipo de slime
        </Text>
        <Text style={styles.instructions}>
          Observe o ritmo, a união da massa e a subida das bolhas.
        </Text>

        <Canvas
          accessible
          accessibilityLabel="Slime AquaFinance carregando"
          accessibilityRole="image"
          style={styles.canvas}
        >
          <Oval rect={{ x: 38, y: 158, width: 164, height: 30 }}>
            <LinearGradient
              colors={COLORS}
              end={GRADIENT_END}
              start={GRADIENT_START}
            />
            <BlurMask blur={8} respectCTM style="outer" />
          </Oval>

          <Circle cx={120} cy={bodyY} opacity={bodyOpacity} r={bodyRadius}>
            <LinearGradient
              colors={COLORS}
              end={GRADIENT_END}
              start={GRADIENT_START}
            />
            <BlurMask blur={9} respectCTM style="outer" />
          </Circle>

          <Circle cx={103} cy={firstY} opacity={firstOpacity} r={firstRadius}>
            <LinearGradient
              colors={COLORS}
              end={GRADIENT_END}
              start={GRADIENT_START}
            />
            <BlurMask blur={6} respectCTM style="outer" />
          </Circle>

          <Circle
            cx={143}
            cy={secondY}
            opacity={secondOpacity}
            r={secondRadius}
          >
            <LinearGradient
              colors={COLORS}
              end={GRADIENT_END}
              start={GRADIENT_START}
            />
            <BlurMask blur={5} respectCTM style="outer" />
          </Circle>

          <Oval
            color="rgba(255,255,255,0.42)"
            rect={{ x: 91, y: 101, width: 14, height: 26 }}
          />
        </Canvas>

        <Text style={styles.motionNote}>
          {reducedMotion
            ? 'Movimento reduzido ativo'
            : 'Animação contínua de carregamento'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default SkiaSlimePrototypeScreen;

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backText: {
    color: '#5ffbd6',
    fontSize: 15,
    fontWeight: '700',
  },
  canvas: {
    height: SIZE,
    marginTop: 24,
    width: SIZE,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 64,
    paddingHorizontal: 24,
  },
  instructions: {
    color: '#B8C7D9',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
  },
  motionNote: {
    color: '#7F90A8',
    fontSize: 12,
    marginTop: 16,
  },
  screen: {
    backgroundColor: '#020d10',
    flex: 1,
  },
  title: {
    color: '#F7FBFF',
    fontSize: 26,
    fontWeight: '900',
  },
});
