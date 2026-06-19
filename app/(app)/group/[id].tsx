import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GlassCard } from '@/components/ui/GlassCard';
import { MemberChip } from '@/components/MemberChip';
import { useAuth } from '@/features/auth/AuthContext';
import {
  addMemberByPhone,
  deleteGroup,
  fetchGroupMembers,
  isGroupLeader,
  removeGroupMember,
} from '@/features/groups/api';
import { DEMO_GROUP, isDemoGroup } from '@/features/dev/devPreview';
import { getDemoSplitsForGroup } from '@/features/dev/demoSplits';
import { fetchGroupReceipts } from '@/features/receipt/api';
import { openSplitForEdit } from '@/features/split/openSplitForEdit';
import { computePersonTotals, formatCents } from '@/features/split/splitMath';
import { useSplitStore } from '@/features/split/splitStore';
import { firstName } from '@/lib/displayName';
import { errorMessage } from '@/lib/errors';
import { toE164US } from '@/lib/phone';
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

function memberDisplayName(m: GroupMember): string {
  return m.profiles?.display_name?.trim() || m.display_label.trim() || '?';
}

function memberChipLabel(m: GroupMember): string {
  return firstName(memberDisplayName(m));
}

export default function GroupHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: myProfile, user } = useAuth();
  const initGroup = useSplitStore((s) => s.initGroup);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [splits, setSplits] = useState<SplitListEntry[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const demo = isDemoGroup(id);
  const isLeader = group ? isGroupLeader(group, user?.id) : false;

  const load = useCallback(async () => {
    if (!id) return;
    if (isDemoGroup(id)) {
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
        totalCents: r.total_cents,
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
    label: memberDisplayName(m),
  }));

  const addMember = async () => {
    if (!id || demo || !user) return;
    setMemberError(null);
    const e164 = toE164US(phoneInput);
    if (!e164) {
      setMemberError('enter a valid 10-digit US number');
      return;
    }
    if (members.some((m) => m.phone === e164)) {
      setMemberError('they are already in this group');
      return;
    }

    setMemberActionLoading(true);
    try {
      await addMemberByPhone(id, e164, user.id);
      setPhoneInput('');
      await load();
    } catch (e) {
      setMemberError(e instanceof Error ? e.message : 'could not add member');
    } finally {
      setMemberActionLoading(false);
    }
  };

  const confirmRemoveMember = (member: GroupMember) => {
    const name = memberChipLabel(member);
    Alert.alert(`remove ${name}?`, 'they will no longer see this group or its splits', [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'remove',
        style: 'destructive',
        onPress: () => removeMember(member.id),
      },
    ]);
  };

  const removeMember = async (memberId: string) => {
    if (!id || demo) return;
    setMemberActionLoading(true);
    setMemberError(null);
    try {
      await removeGroupMember(memberId);
      await load();
    } catch (e) {
      setMemberError(errorMessage(e));
    } finally {
      setMemberActionLoading(false);
    }
  };

  const confirmDeleteGroup = () => {
    if (!group) return;
    Alert.alert(
      `delete ${group.name}?`,
      'this removes the group and all its splits for everyone',
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'delete group',
          style: 'destructive',
          onPress: deleteGroupAction,
        },
      ]
    );
  };

  const deleteGroupAction = async () => {
    if (!id || demo) return;
    setMemberActionLoading(true);
    setMemberError(null);
    try {
      await deleteGroup(id);
      router.replace('/(app)');
    } catch (e) {
      setMemberError(errorMessage(e));
      setMemberActionLoading(false);
    }
  };

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
          {members.map((m) => {
            const label = memberChipLabel(m);
            const profileUserId =
              m.user_id ??
              (demo && m.display_label === 'you' ? myProfile?.id : null);
            const leader =
              Boolean(group && m.user_id && group.created_by === m.user_id);

            return (
              <MemberChip
                key={m.id}
                label={label}
                avatarUrl={m.profiles?.avatar_url}
                small
                isLeader={leader}
                onPress={
                  profileUserId
                    ? () => router.push(`/(app)/profile/${profileUserId}`)
                    : undefined
                }
              />
            );
          })}
        </ScrollView>

        {!demo ? (
          <>
            <Text style={styles.section}>add someone</Text>
            <View style={styles.addRow}>
              <View style={styles.phoneField}>
                <Input
                  placeholder="friend's phone"
                  keyboardType="phone-pad"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                />
              </View>
              <Button
                label="add"
                variant="secondary"
                onPress={addMember}
                loading={memberActionLoading}
                style={styles.addBtn}
              />
            </View>

            {isLeader && members.length > 0 ? (
              <GlassCard>
                {members.map((m, index) => {
                  const showRemove = m.user_id !== user?.id;

                  return (
                    <View
                      key={m.id}
                      style={[styles.memberRow, index > 0 && styles.memberRowBorder]}
                    >
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{memberChipLabel(m)}</Text>
                        {m.user_id && group?.created_by === m.user_id ? (
                          <Text style={styles.memberMeta}>leader</Text>
                        ) : m.is_pending ? (
                          <Text style={styles.memberMeta}>invited</Text>
                        ) : null}
                      </View>
                      {showRemove ? (
                        <Pressable
                          onPress={() => confirmRemoveMember(m)}
                          hitSlop={8}
                          disabled={memberActionLoading}
                        >
                          <Text style={styles.remove}>remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </GlassCard>
            ) : null}

            {memberError ? <Text style={styles.memberError}>{memberError}</Text> : null}
          </>
        ) : null}

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

        {isLeader && !demo ? (
          <Button
            label="delete group"
            variant="secondary"
            onPress={confirmDeleteGroup}
            loading={memberActionLoading}
            style={styles.deleteBtn}
          />
        ) : null}
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  phoneField: { flex: 1 },
  addBtn: { paddingHorizontal: 20, minHeight: 48 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  memberRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  memberInfo: { flex: 1, gap: 2 },
  memberName: {
    ...typography.body,
    color: colors.text,
  },
  memberMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  remove: {
    ...typography.caption,
    color: colors.danger,
  },
  memberError: {
    ...typography.caption,
    color: colors.danger,
  },
  deleteBtn: {
    marginTop: spacing.md,
  },
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
