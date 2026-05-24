import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '@/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
};

export function MemberChip({ label, selected, onPress, small }: Props) {
  const initial = label.trim().charAt(0).toUpperCase() || '?';

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        small && styles.chipSmall,
        selected && styles.chipSelected,
      ]}
    >
      <View style={[styles.avatar, selected && styles.avatarSelected]}>
        <Text style={[styles.initial, selected && styles.initialSelected]}>
          {initial}
        </Text>
      </View>
      <Text
        style={[styles.label, small && styles.labelSmall, selected && styles.labelSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
    maxWidth: 80,
  },
  chipSmall: {
    minWidth: 52,
    maxWidth: 64,
  },
  chipSelected: {},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.creamDark,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  initial: {
    ...typography.subtitle,
    color: colors.textSecondary,
  },
  initialSelected: {
    color: colors.cream,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelSmall: {
    fontSize: 11,
  },
  labelSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
