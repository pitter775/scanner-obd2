import { useEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../config/theme';

type AppButtonProps = PropsWithChildren<{
  onPress: () => void;
  icon?: string;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}>;

export function AppButton({ children, icon, onPress, tone = 'primary', disabled }: AppButtonProps) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (disabled) {
      glow.stopAnimation();
      glow.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          duration: tone === 'primary' ? 900 : 1300,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          duration: tone === 'primary' ? 900 : 1300,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [disabled, glow, tone]);

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: tone === 'primary' ? [0.18, 0.65] : [0.08, 0.35],
  });
  const glowStyle = tone === 'danger' ? styles.dangerGlow : tone === 'secondary' ? styles.secondaryGlow : styles.primaryGlow;

  function animatePress(toValue: number) {
    Animated.spring(pressScale, {
      friction: 5,
      tension: 180,
      toValue,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale: pressScale }] }]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => !disabled && animatePress(0.965)}
        onPressOut={() => !disabled && animatePress(1)}
        style={[
        styles.button,
        styles[tone],
        disabled && styles.disabled,
      ]}
      >
        <Animated.View pointerEvents="none" style={[styles.glow, glowStyle, { opacity: glowOpacity }]} />
        <View style={styles.content}>
          {icon ? <Text adjustsFontSizeToFit numberOfLines={1} style={styles.icon}>{icon}</Text> : null}
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.label}>{children}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 8,
  },
  button: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    shadowColor: colors.primaryGlow,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { height: 0, width: 0 },
    elevation: 6,
  },
  primary: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryGlow,
  },
  secondary: {
    backgroundColor: colors.panel,
    borderColor: colors.borderStrong,
  },
  danger: {
    backgroundColor: colors.dangerDark,
    borderColor: colors.danger,
    shadowColor: colors.danger,
  },
  primaryGlow: {
    backgroundColor: colors.primaryGlow,
  },
  secondaryGlow: {
    backgroundColor: colors.electric,
  },
  dangerGlow: {
    backgroundColor: colors.danger,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    zIndex: 1,
  },
  disabled: {
    opacity: 0.45,
  },
  glow: {
    height: 80,
    left: -24,
    position: 'absolute',
    top: -16,
    transform: [{ rotate: '-14deg' }],
    width: 96,
  },
  icon: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  label: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
