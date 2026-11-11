import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

type OceanicLogoLoaderProps = {
  accessibilityLabel?: string;
  size?: number;
};

export function OceanicLogoLoader({
  accessibilityLabel = 'Marca AquaFinance',
  size = 100,
}: OceanicLogoLoaderProps) {
  const [progress] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || reducedMotion) {
      progress.setValue(0.25);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(progress, {
        duration: 2400,
        easing: Easing.inOut(Easing.sin),
        toValue: 1,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [progress, reducedMotion]);

  const bodyScaleX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 1.12, 0.94, 1.08, 1],
  });
  const bodyScaleY = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 0.9, 1.08, 0.92, 1],
  });
  const bodyTranslateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -size * 0.04, 0],
  });
  const puddleScaleX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.88, 1],
  });
  const puddleScaleY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.15, 1],
  });
  const neckScaleY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 1.18, 0.8],
  });

  const blobOneTranslateY = progress.interpolate({
    inputRange: [0, 0.12, 0.58, 0.7, 1],
    outputRange: [0, 0, -size * 0.38, -size * 0.43, -size * 0.43],
  });
  const blobOneOpacity = progress.interpolate({
    inputRange: [0, 0.12, 0.22, 0.58, 0.7, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });
  const blobOneScale = progress.interpolate({
    inputRange: [0, 0.12, 0.34, 0.58, 0.7, 1],
    outputRange: [0.55, 0.55, 1, 0.72, 0.3, 0.3],
  });

  const blobTwoTranslateY = progress.interpolate({
    inputRange: [0, 0.48, 0.9, 1],
    outputRange: [0, 0, -size * 0.32, -size * 0.38],
  });
  const blobTwoOpacity = progress.interpolate({
    inputRange: [0, 0.48, 0.58, 0.9, 1],
    outputRange: [0, 0, 0.9, 0.9, 0],
  });
  const blobTwoScale = progress.interpolate({
    inputRange: [0, 0.48, 0.68, 0.9, 1],
    outputRange: [0.45, 0.45, 1, 0.7, 0.3],
  });

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={[styles.container, { height: size, width: size }]}
    >
      <Animated.View
        style={[
          styles.neck,
          {
            bottom: size * 0.31,
            height: size * 0.34,
            transform: [{ scaleY: neckScaleY }],
            width: size * 0.2,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.puddle,
          {
            bottom: size * 0.06,
            height: size * 0.2,
            transform: [{ scaleX: puddleScaleX }, { scaleY: puddleScaleY }],
            width: size * 0.78,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.body,
          {
            bottom: size * 0.12,
            height: size * 0.52,
            transform: [
              { translateY: bodyTranslateY },
              { scaleX: bodyScaleX },
              { scaleY: bodyScaleY },
            ],
            width: size * 0.56,
          },
        ]}
      >
        <View
          style={[
            styles.highlight,
            {
              height: size * 0.12,
              left: size * 0.1,
              top: size * 0.09,
              width: size * 0.08,
            },
          ]}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.blob,
          styles.blobPrimary,
          {
            bottom: size * 0.46,
            height: size * 0.24,
            marginLeft: -size * 0.2,
            opacity: blobOneOpacity,
            transform: [
              { translateY: blobOneTranslateY },
              { scale: blobOneScale },
            ],
            width: size * 0.24,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.blob,
          styles.blobSecondary,
          {
            bottom: size * 0.42,
            height: size * 0.17,
            marginLeft: size * 0.28,
            opacity: blobTwoOpacity,
            transform: [
              { translateY: blobTwoTranslateY },
              { scale: blobTwoScale },
            ],
            width: size * 0.17,
          },
        ]}
      />
    </View>
  );
}

const liquidShadow = Platform.select({
  web: { boxShadow: '0 0 18px rgba(0, 245, 212, 0.5)' },
  default: {
    elevation: 6,
    shadowColor: '#00f5d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
  },
});

const styles = StyleSheet.create({
  blob: {
    borderRadius: 999,
    left: '50%',
    position: 'absolute',
  },
  blobPrimary: {
    backgroundColor: '#5ffbd6',
  },
  blobSecondary: {
    backgroundColor: '#0f9caa',
  },
  body: {
    alignItems: 'flex-start',
    backgroundColor: '#00d2b4',
    borderRadius: 999,
    justifyContent: 'flex-start',
    position: 'absolute',
    ...liquidShadow,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    position: 'relative',
  },
  highlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 999,
    position: 'absolute',
    transform: [{ rotate: '25deg' }],
  },
  neck: {
    backgroundColor: '#00d2b4',
    borderRadius: 999,
    position: 'absolute',
  },
  puddle: {
    backgroundColor: '#005c8a',
    borderRadius: 999,
    position: 'absolute',
    ...liquidShadow,
  },
});
