import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { FinanceTheme } from '../styles/financeTheme';

type LiquidButtonProps = {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
};

export function LiquidButton({ disabled, label, loading, onPress }: LiquidButtonProps) {
  const [drift] = useState(() => new Animated.Value(0));
  const [pressed] = useState(() => new Animated.Value(1));
  const [ripple] = useState(() => new Animated.Value(0));
  const [rippleOrigin, setRippleOrigin] = useState({ x: 0, y: 0 });
  const reducedMotion = useReducedMotion();
  const isDisabled = Boolean(disabled || loading);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || reducedMotion) {
      drift.setValue(0.5);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { duration: 2600, toValue: 1, useNativeDriver: true }),
        Animated.timing(drift, { duration: 2600, toValue: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, reducedMotion]);

  const animatePress = (toValue: number) => {
    if (reducedMotion) return;
    Animated.spring(pressed, {
      friction: 7,
      tension: 180,
      toValue,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    animatePress(0.98);
    if (reducedMotion) return;

    setRippleOrigin({
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    });
    ripple.setValue(0);
    Animated.timing(ripple, {
      duration: 700,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressed }] }}>
      <Pressable
        accessibilityLabel={loading ? 'Entrando' : label}
        accessibilityRole="button"
        accessibilityState={{ busy: Boolean(loading), disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={() => animatePress(1)}
        style={[styles.button, isDisabled ? styles.disabled : null]}
      >
        <View pointerEvents="none" style={styles.liquidLayer}>
          <Animated.View
            style={[
              styles.orb,
              styles.orbA,
              {
                transform: [
                  {
                    translateX: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 20],
                    }),
                  },
                  {
                    translateY: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, -8],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.orb,
              styles.orbB,
              {
                transform: [
                  {
                    translateX: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, -18],
                    }),
                  },
                  {
                    scale: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.orb,
              styles.orbC,
              {
                transform: [
                  {
                    translateY: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-6, 9],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ripple,
              {
                left: rippleOrigin.x - 20,
                opacity: ripple.interpolate({
                  inputRange: [0, 0.7, 1],
                  outputRange: [0.8, 0.45, 0],
                }),
                top: rippleOrigin.y - 20,
                transform: [
                  {
                    scale: ripple.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.2, 5],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <View style={styles.highlight} />
        <Text style={styles.label}>{loading ? 'Entrando...' : label}</Text>
        {loading ? (
          <ActivityIndicator color={FinanceTheme.colors.abyss[950]} size="small" />
        ) : (
          <MaterialCommunityIcons
            color={FinanceTheme.colors.abyss[950]}
            name="arrow-right"
            size={18}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.aquateal[400],
    borderColor: 'rgba(95, 251, 214, 0.5)',
    borderRadius: FinanceTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    overflow: 'hidden',
    shadowColor: FinanceTheme.shadow.buttonGlow.color,
    shadowOffset: { width: 0, height: FinanceTheme.shadow.buttonGlow.offsetY },
    shadowOpacity: FinanceTheme.shadow.buttonGlow.opacity,
    shadowRadius: FinanceTheme.shadow.buttonGlow.radius,
    elevation: FinanceTheme.shadow.buttonGlow.elevation,
  },
  disabled: { opacity: FinanceTheme.opacity.disabled },
  highlight: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    height: '48%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  label: {
    color: FinanceTheme.colors.abyss[950],
    fontSize: FinanceTheme.typography.button,
    fontWeight: '800',
    zIndex: 2,
  },
  liquidLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  orb: { borderRadius: 999, position: 'absolute' },
  orbA: {
    backgroundColor: FinanceTheme.colors.aquateal[300],
    height: 68,
    left: 20,
    top: -20,
    width: 68,
  },
  orbB: {
    backgroundColor: FinanceTheme.colors.aquateal[500],
    bottom: -28,
    height: 76,
    right: 35,
    width: 76,
  },
  orbC: {
    backgroundColor: FinanceTheme.colors.phthalo[500],
    height: 54,
    right: -12,
    top: 0,
    width: 54,
  },
  ripple: {
    backgroundColor: FinanceTheme.colors.aquateal[300],
    borderRadius: 999,
    height: 40,
    position: 'absolute',
    width: 40,
  },
});
