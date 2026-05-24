import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { fetchMyGroups } from '@/features/groups/api';
import type { Group } from '@/types/database';
import { colors, spacing, typography, radius } from '@/theme';

export default function GroupsHomeScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyGroups();
      setGroups(data);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Logo size="header" />
        <Text style={styles.sub}>your groups</Text>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          !loading ? (
            <GlassCard style={styles.empty}>
              <Text style={styles.emptyTitle}>no groups yet</Text>
              <Text style={styles.emptySub}>
                create one for a trip, brunch, or roommate groceries
              </Text>
            </GlassCard>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(app)/group/${item.id}`)}
            style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.9 }]}
          >
            <GlassCard>
              <View style={styles.cardRow}>
                <Text style={styles.emoji}>{item.emoji ?? '✨'}</Text>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardSub}>tap to scan a receipt</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </GlassCard>
          </Pressable>
        )}
      />

      <View style={styles.footer}>
        <Button
          label="+ new group"
          onPress={() => router.push('/(app)/group/create')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 100,
  },
  cardPress: {
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: { fontSize: 32 },
  cardText: { flex: 1 },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  cardSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 28,
    color: colors.textMuted,
  },
  empty: { marginTop: spacing.xl },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: 8,
  },
  emptySub: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
