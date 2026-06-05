import { useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  Bluetooth,
  Bug,
  Car,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronUp,
  Gauge,
  Info,
  LogIn,
  LogOut,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  UserPlus,
  Wrench,
  Zap,
} from 'lucide-react-native';

import { colors, spacing } from '../config/theme';

export type AppButtonIcon =
  | 'bluetooth'
  | 'bug'
  | 'car'
  | 'chart'
  | 'chevron-down'
  | 'chevron-up'
  | 'gauge'
  | 'info'
  | 'login'
  | 'logout'
  | 'pause'
  | 'play'
  | 'plus'
  | 'radar'
  | 'refresh'
  | 'save'
  | 'search'
  | 'send'
  | 'shield-alert'
  | 'user-plus'
  | 'wrench'
  | 'zap';

type AppButtonProps = PropsWithChildren<{
  onPress: () => void;
  icon?: AppButtonIcon;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  compact?: boolean;
}>;

const iconMap: Record<AppButtonIcon, LucideIcon> = {
  bluetooth: Bluetooth,
  bug: Bug,
  car: Car,
  chart: ChartNoAxesCombined,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  gauge: Gauge,
  info: Info,
  login: LogIn,
  logout: LogOut,
  pause: Pause,
  play: Play,
  plus: Plus,
  radar: Radar,
  refresh: RefreshCw,
  save: Save,
  search: Search,
  send: Send,
  'shield-alert': ShieldAlert,
  'user-plus': UserPlus,
  wrench: Wrench,
  zap: Zap,
};

export function AppButton({ children, compact, icon, onPress, tone = 'primary', disabled }: AppButtonProps) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const glowStyle = tone === 'danger' ? styles.dangerGlow : tone === 'secondary' ? styles.secondaryGlow : styles.primaryGlow;
  const Icon = icon ? iconMap[icon] : null;

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
        compact && styles.compact,
        styles[tone],
        disabled && styles.disabled,
      ]}
      >
        <View pointerEvents="none" style={[styles.glow, glowStyle, tone === 'primary' ? styles.glowPrimary : styles.glowSecondary]} />
        <View style={styles.content}>
          {Icon ? <Icon color={colors.white} size={compact ? 15 : 20} strokeWidth={2.6} /> : null}
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.label, compact && styles.compactLabel]}>{children}</Text>
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
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { height: 0, width: 0 },
    elevation: 6,
  },
  primary: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryGlow,
  },
  secondary: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
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
  compact: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  compactLabel: {
    fontSize: 10,
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
    opacity: 0.25,
    position: 'absolute',
    top: -16,
    transform: [{ rotate: '-14deg' }],
    width: 96,
  },
  glowPrimary: {
    opacity: 0.42,
  },
  glowSecondary: {
    opacity: 0.16,
  },
  label: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
