import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { MemberChip } from '@/components/MemberChip';
import { fetchGroupMembers } from '@/features/groups/api';
import { DEMO_GROUP, isDevPreviewActive } from '@/features/dev/devPreview';
import { useSplitStore } from '@/features/split/splitStore';
import type { GroupMember } from '@/types/database';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types/database';
import { colors, spacing, typography } from '@/theme';

export default function GroupHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const initGroup = useSplitStore((s) => s.initGroup);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    if (isDevPreviewActive() && id === DEMO_GROUP.id) {
      setGroup(DEMO_GROUP);
      setMembers(await fetchGroupMembers(id));
      return;
    }
    const [{ data: g }, mems] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      fetchGroupMembers(id),
    ]);
    setGroup(g);
    setMembers(mems);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const startScan = () => {
    if (!id) return;
    const people = members.map((m) => ({
      id: m.id,
      label: m.profiles?.display_name ?? m.display_label,
    }));
    initGroup(id, people);
    router.push({ pathname: '/(app)/split/camera', params: { groupId: id } });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← groups</Text>
        </Pressable>

        <Text style={styles.emoji}>{group?.emoji ?? '✨'}</Text>
        <Text style={styles.title}>{group?.name ?? '…'}</Text>

        <Text style={styles.section}>who's in</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {members.map((m) => (
            <MemberChip
              key={m.id}
              label={m.profiles?.display_name ?? m.display_label}
              small
            />
          ))}
        </ScrollView>

        <GlassCard style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>got a receipt?</Text>
          <Text style={styles.ctaSub}>snap it and we'll split it in seconds</Text>
        </GlassCard>

        <Button label="scan receipt" onPress={startScan} />

        <Button
          label="enter items manually"
          variant="secondary"
          onPress={() => {
            if (!id) return;
            const people = members.map((m) => ({
              id: m.id,
              label: m.profiles?.display_name ?? m.display_label,
            }));
            initGroup(id, people);
            router.push({
              pathname: '/(app)/split/review',
              params: { groupId: id, manual: '1' },
            });
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  back: { marginBottom: spacing.xs },
  backText: { ...typography.body, color: colors.primary },
  emoji: { fontSize: 48, textAlign: 'center' },
  title: {
    ...typography.hero,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
  },
  section: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textTransform: 'none',
    fontSize: 14,
  },
  chips: { marginVertical: spacing.sm },
  ctaCard: { marginTop: spacing.lg },
  ctaTitle: {
    ...typography.title,
    fontSize: 18,
    color: colors.text,
  },
  ctaSub: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
