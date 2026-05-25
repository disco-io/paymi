import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { MemberChip } from '@/components/MemberChip';
import { fetchGroupMembers } from '@/features/groups/api';
import { DEMO_GROUP, isDevPreviewActive } from '@/features/dev/devPreview';
import { getDemoSplitsForGroup } from '@/features/dev/demoSplits';
import { fetchGroupReceipts } from '@/features/receipt/api';
import { openSplitForEdit } from '@/features/split/openSplitForEdit';
import { computePersonTotals, formatCents } from '@/features/split/splitMath';
import { useSplitStore } from '@/features/split/splitStore';
import type { GroupMember } from '@/types/database';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types/database';
import { colors, spacing, typography } from '@/theme';

type SplitListEntry = {
  id: string;
  title: string;
  subtitle: string;
  totalCents: number;
};

function formatSplitDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function GroupHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const initGroup = useSplitStore((s) => s.initGroup);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [splits, setSplits] = useState<SplitListEntry[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    if (isDevPreviewActive() && id === DEMO_GROUP.id) {
      setGroup(DEMO_GROUP);
      setMembers(await fetchGroupMembers(id));
      const demoSplits = getDemoSplitsForGroup(id).map((s) => {
        const total = computePersonTotals(s.people, s.items, s.taxCents, s.tipCents).reduce(
          (sum, t) => sum + t.totalCents,
          0
        );
        return {
          id: s.receiptId,
          title: s.merchant?.trim() || 'receipt split',
          subtitle: formatSplitDate(s.savedAt),
          totalCents: total,
        };
      });
      setSplits(demoSplits);
      return;
    }
    const [{ data: g }, mems, receipts] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      fetchGroupMembers(id),
      fetchGroupReceipts(id),
    ]);
    setGroup(g);
    setMembers(mems);
    setSplits(
      receipts.map((r) => ({
        id: r.id,
        title: r.merchant?.trim() || 'receipt split',
        subtitle: formatSplitDate(r.created_at),
        totalCents: r.tax_cents + r.tip_cents,
      }))
    );
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const people = members.map((m) => ({
    id: m.id,
    label: m.profiles?.display_name ?? m.display_label,
  }));

  const startScan = () => {
    if (!id) return;
    initGroup(id, people);
    router.push({ pathname: '/(app)/split/camera', params: { groupId: id } });
  };

  const startManual = () => {
    if (!id) return;
    initGroup(id, people);
    router.push({
      pathname: '/(app)/split/review',
      params: { groupId: id, manual: '1' },
    });
  };

  const editSplit = async (receiptId: string) => {
    if (!id) return;
    await openSplitForEdit(receiptId, id, people);
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

        {splits.length > 0 && (
          <>
            <Text style={styles.section}>splits</Text>
            {splits.map((split) => (
              <Pressable key={split.id} onPress={() => editSplit(split.id)}>
                <GlassCard style={styles.splitCard}>
                  <View style={styles.splitRow}>
                    <View style={styles.splitText}>
                      <Text style={styles.splitTitle}>{split.title}</Text>
                      <Text style={styles.splitSub}>{split.subtitle}</Text>
                    </View>
                    <View style={styles.splitRight}>
                      {split.totalCents > 0 && (
                        <Text style={styles.splitTotal}>
                          {formatCents(split.totalCents)}
                        </Text>
                      )}
                      <Text style={styles.editLabel}>edit</Text>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </>
        )}

        <GlassCard style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>got a receipt?</Text>
          <Text style={styles.ctaSub}>snap it and we'll split it in seconds</Text>
        </GlassCard>

        <Button label="scan receipt" onPress={startScan} />

        <Button label="enter items manually" variant="secondary" onPress={startManual} />
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
  splitCard: { marginBottom: 0 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  splitText: { flex: 1 },
  splitTitle: {
    ...typography.title,
    fontSize: 17,
    color: colors.text,
  },
  splitSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  splitRight: { alignItems: 'flex-end', gap: 2 },
  splitTotal: {
    ...typography.subtitle,
    color: colors.primaryDark,
  },
  editLabel: {
    ...typography.caption,
    color: colors.primary,
  },
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
