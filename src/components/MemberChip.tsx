import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { colors, radius, typography } from '@/theme';

type Props = {
  label: string;
  avatarUrl?: string | null;
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
  isLeader?: boolean;
};

export function MemberChip({ label, avatarUrl, selected, onPress, small, isLeader }: Props) {
  const avatarSize = small ? 'sm' : 'sm';

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        small && styles.chipSmall,
        selected && styles.chipSelected,
      ]}
    >
      <View style={[styles.avatarWrap, selected && styles.avatarWrapSelected]}>
        <Avatar name={label} avatarUrl={avatarUrl} size={avatarSize} />
      </View>
      <Text
        style={[styles.label, small && styles.labelSmall, selected && styles.labelSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isLeader ? <Text style={styles.leaderBadge}>leader</Text> : null}
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
  avatarWrap: {
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarWrapSelected: {
    borderColor: colors.primaryDark,
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
  leaderBadge: {
    ...typography.caption,
    fontSize: 10,
    color: colors.primary,
    textTransform: 'lowercase',
  },
});
