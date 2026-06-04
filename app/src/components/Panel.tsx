import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../config/theme';

type PanelProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
}>;

export function Panel({ children, title, subtitle }: PanelProps) {
  return (
    <View style={styles.panel}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
    shadowColor: colors.primaryGlow,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  body: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
