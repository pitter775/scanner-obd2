import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../config/theme';

type ConnectionGaugeProps = {
  label: string;
  active: boolean;
  moduleName?: string;
};

export function ConnectionGauge({ active, label, moduleName = 'OBDII' }: ConnectionGaugeProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      scan.stopAnimation();
      pulse.setValue(0);
      scan.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 900,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 900,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const scanLoop = Animated.loop(
      Animated.timing(scan, {
        duration: 1400,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    );

    pulseLoop.start();
    scanLoop.start();

    return () => {
      pulseLoop.stop();
      scanLoop.stop();
    };
  }, [active, pulse, scan]);

  if (!active) {
    return null;
  }

  const outerScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const outerOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });
  const scanTranslate = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [-54, 54],
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.visual}>
        <Animated.View style={[styles.ring, styles.ringOuter, { opacity: outerOpacity, transform: [{ scale: outerScale }] }]} />
        <View style={[styles.ring, styles.ringInner]} />
        <View style={styles.module}>
          <Animated.View style={[styles.scanLine, { transform: [{ translateX: scanTranslate }] }]} />
          <Text style={styles.moduleText}>{moduleName}</Text>
          <Text style={styles.moduleSubtext}>OBD2</Text>
        </View>
      </View>
      <View style={styles.steps}>
        <Step active label="Bluetooth" />
        <Step active label="Adaptador" />
        <Step active label="Resposta" />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function Step({ active, label }: { active: boolean; label: string }) {
  return (
    <View style={styles.step}>
      <View style={[styles.dot, active && styles.dotActive]} />
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: colors.border,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  module: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 2,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 122,
  },
  moduleSubtext: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  moduleText: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  ring: {
    borderRadius: 100,
    position: 'absolute',
  },
  ringInner: {
    borderColor: colors.warning,
    borderWidth: 2,
    height: 132,
    opacity: 0.45,
    width: 132,
  },
  ringOuter: {
    borderColor: colors.primary,
    borderWidth: 2,
    height: 162,
    width: 162,
  },
  scanLine: {
    backgroundColor: colors.primary,
    height: 96,
    opacity: 0.18,
    position: 'absolute',
    width: 26,
  },
  step: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  stepText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  visual: {
    alignItems: 'center',
    height: 170,
    justifyContent: 'center',
    width: 180,
  },
  wrapper: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
});
