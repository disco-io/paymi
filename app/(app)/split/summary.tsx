import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useSplitStore } from '@/features/split/splitStore';
import { computePersonTotals, formatCents } from '@/features/split/splitMath';
import {
  createReceipt,
  persistReceiptSplit,
} from '@/features/receipt/api';
import { useAuth } from '@/features/auth/AuthContext';
import { isDemoGroup } from '@/features/dev/devPreview';
import {
  newDemoReceiptId,
  saveDemoSplit,
} from '@/features/dev/demoSplits';
import { colors, spacing, typography } from '@/theme';

function buildPersistPayload(items: ReturnType<typeof useSplitStore.getState>['items']) {
  const validItems = items.filter((i) => i.name.trim().length > 0);
  return {
    itemRows: validItems.map((i) => ({
      name: i.name.trim(),
      amount_cents: i.amountCents,
      quantity: 1,
    })),
    assignmentsByIndex: validItems.map((i) =>
      Object.entries(i.assignments).map(([member_id, share]) => ({
        member_id,
        share,
      }))
    ),
  };
}

export default function SummaryScreen() {
  const { groupId, editing } = useLocalSearchParams<{
    groupId: string;
    editing?: string;
  }>();
  const { user } = useAuth();
  const people = useSplitStore((s) => s.people);
  const items = useSplitStore((s) => s.items);
  const taxCents = useSplitStore((s) => s.taxCents);
  const tipCents = useSplitStore((s) => s.tipCents);
  const receiptId = useSplitStore((s) => s.receiptId);
  const merchant = useSplitStore((s) => s.merchant);
  const imagePath = useSplitStore((s) => s.imagePath);
  const reset = useSplitStore((s) => s.reset);
  const setReceiptId = useSplitStore((s) => s.setReceiptId);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = computePersonTotals(people, items, taxCents, tipCents);
  const grandTotal = totals.reduce((s, t) => s + t.totalCents, 0);
  const isEditing = editing === '1' || !!receiptId;

  const editSplit = () => {
    if (!groupId) return;
    router.push({
      pathname: '/(app)/split/assign',
      params: isEditing ? { groupId, editing: '1' } : { groupId },
    });
  };

  const editItems = () => {
    if (!groupId) return;
    router.push({
      pathname: '/(app)/split/review',
      params: isEditing ? { groupId, editing: '1' } : { groupId },
    });
  };

  const saveAndFinish = async () => {
    if (!groupId) return;

    const { itemRows, assignmentsByIndex } = buildPersistPayload(items);
    if (itemRows.length === 0) return;

    if (isDemoGroup(groupId)) {
      const rid = receiptId ?? newDemoReceiptId();
      saveDemoSplit({
        receiptId: rid,
        groupId,
        merchant,
        taxCents,
        tipCents,
        items: items.filter((i) => i.name.trim()),
        people: [...people],
        savedAt: new Date().toISOString(),
      });
      setSaved(true);
      reset();
      router.replace(`/(app)/group/${groupId}`);
      return;
    }

    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      let rid = receiptId;
      if (!rid) {
        const receipt = await createReceipt(groupId, user.id, {
          image_path: imagePath,
          merchant,
          receipt_date: null,
          tax_cents: taxCents,
          tip_cents: tipCents,
        });
        rid = receipt.id;
        setReceiptId(rid);
      }

      await persistReceiptSplit(
        rid,
        {
          merchant,
          tax_cents: taxCents,
          tip_cents: tipCents,
        },
        itemRows,
        assignmentsByIndex
      );

      setSaved(true);
      reset();
      router.replace(`/(app)/group/${groupId}`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'could not save split');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{isEditing ? 'update split' : 'the damage 💸'}</Text>
        <Text style={styles.sub}>
          {isEditing
            ? 'change assignments or items, then save again'
            : 'tax + tip split by what each person ordered'}
        </Text>

        {totals
          .sort((a, b) => b.totalCents - a.totalCents)
          .map((t) => (
            <GlassCard key={t.memberId} style={styles.personCard}>
              <View style={styles.personRow}>
                <Text style={styles.personName}>{t.label}</Text>
                <Text style={styles.personTotal}>{formatCents(t.totalCents)}</Text>
              </View>
              <Text style={styles.breakdown}>
                food {formatCents(t.subtotalCents)} · tax {formatCents(t.taxCents)}{' '}
                · tip {formatCents(t.tipCents)}
              </Text>
            </GlassCard>
          ))}

        <Text style={styles.grand}>total {formatCents(grandTotal)}</Text>

        {!saved && (
          <>
            <Button label="edit assignments" variant="secondary" onPress={editSplit} />
            <Button label="edit items" variant="secondary" onPress={editItems} />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={saved ? 'saved ✓' : isEditing ? 'save changes' : 'save split'}
          onPress={saveAndFinish}
          loading={saving}
          disabled={saved}
        />

        <Button
          label="back to group"
          variant="ghost"
          onPress={() => {
            reset();
            router.replace(`/(app)/group/${groupId}`);
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  personCard: {},
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personName: { ...typography.subtitle, color: colors.text },
  personTotal: { ...typography.subtitle, color: colors.primaryDark },
  breakdown: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 6,
  },
  grand: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
