import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors, spacing } from '../config/theme';

type TextFieldProps = TextInputProps & {
  label: string;
};

export function TextField({ label, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
});
