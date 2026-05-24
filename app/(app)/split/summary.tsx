import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useSplitStore } from '@/features/split/splitStore';
import { computePersonTotals, formatCents } from '@/features/split/splitMath';
import {
  saveReceiptItems,
  saveAssignments,
  createReceipt,
} from '@/features/receipt/api';
import { useAuth } from '@/features/auth/AuthContext';
import { isDevPreviewActive } from '@/features/dev/devPreview';
import { colors, spacing, typography } from '@/theme';

export default function SummaryScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
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

  const totals = computePersonTotals(people, items, taxCents, tipCents);
  const grandTotal = totals.reduce((s, t) => s + t.totalCents, 0);

  const saveAndFinish = async () => {
    if (!groupId) return;

    if (isDevPreviewActive()) {
      setSaved(true);
      reset();
      router.replace(`/(app)/group/${groupId}`);
      return;
    }

    if (!user) return;
    setSaving(true);
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

      const dbItems = await saveReceiptItems(
        rid,
        items.map((i) => ({
          name: i.name,
          amount_cents: i.amountCents,
          quantity: 1,
        }))
      );

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const dbItem = dbItems[i];
        if (!dbItem) continue;
        const assignments = Object.entries(item.assignments).map(
          ([memberId, share]) => ({
            member_id: memberId,
            share,
          })
        );
        await saveAssignments(dbItem.id, assignments);
      }

      setSaved(true);
      reset();
      router.replace(`/(app)/group/${groupId}`);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>the damage 💸</Text>
        <Text style={styles.sub}>
          tax + tip split by what each person ordered
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

        <Button
          label={saved ? 'saved ✓' : 'save split'}
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
});
