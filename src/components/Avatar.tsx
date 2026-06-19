import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '@/theme';

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = { sm: 48, md: 72, lg: 112 } as const;

export function Avatar({ name, avatarUrl, size = 'md' }: Props) {
  const px = SIZES[size];
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, { width: px, height: px, borderRadius: px / 2 }]}
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: px, height: px, borderRadius: px / 2 }]}>
      <Text style={[styles.initial, size === 'lg' && styles.initialLg]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.creamDark,
  },
  fallback: {
    backgroundColor: colors.creamDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    ...typography.subtitle,
    color: colors.textSecondary,
  },
  initialLg: {
    fontSize: 40,
  },
});
