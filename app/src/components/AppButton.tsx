import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '../config/theme';

type AppButtonProps = PropsWithChildren<{
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}>;

export function AppButton({ children, onPress, tone = 'primary', disabled }: AppButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[tone],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
