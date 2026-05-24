import { StyleSheet, TextInput, TextInputProps, View, Text } from 'react-native';
import { colors, radius, typography } from '@/theme';

type Props = TextInputProps & {
  label?: string;
};

export function Input({ label, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
