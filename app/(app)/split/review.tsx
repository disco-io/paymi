import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Platform,
  type TextStyle,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { MoneyField } from '@/components/MoneyField';
import { useSplitStore } from '@/features/split/splitStore';
import { useAuth } from '@/features/auth/AuthContext';
import { createReceipt } from '@/features/receipt/api';
import { formatCents } from '@/features/split/splitMath';
import { colors, spacing, typography, radius, inputAccent } from '@/theme';

const webInputReset: TextStyle | undefined =
  Platform.OS === 'web' ? { outlineWidth: 0 } : undefined;

function ItemRow({
  name,
  amountCents,
  isDraft,
  onUpdate,
  onRemove,
}: {
  name: string;
  amountCents: number;
  isDraft: boolean;
  onUpdate: (patch: { name?: string; amountCents?: number }) => void;
  onRemove: () => void;
}) {
  const [nameFocused, setNameFocused] = useState(false);
  const showPlaceholder = isDraft && !nameFocused && !name.trim();

  return (
    <View style={styles.itemRow}>
      <TextInput
        style={[styles.itemName, webInputReset]}
        placeholder={showPlaceholder ? 'new item' : undefined}
        placeholderTextColor={colors.textMuted}
        value={name}
        onFocus={() => setNameFocused(true)}
        onBlur={() => setNameFocused(false)}
        onChangeText={(t) => onUpdate({ name: t })}
        {...inputAccent}
      />
      <MoneyField
        compact
        cents={amountCents}
        onChangeCents={(c) => onUpdate({ amountCents: c })}
      />
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={styles.remove}>×</Text>
      </Pressable>
    </View>
  );
}

export default function ReviewScreen() {
  const { groupId, manual, editing } = useLocalSearchParams<{
    groupId: string;
    manual?: string;
    editing?: string;
  }>();
  const { user } = useAuth();
  const merchant = useSplitStore((s) => s.merchant);
  const taxCents = useSplitStore((s) => s.taxCents);
  const tipCents = useSplitStore((s) => s.tipCents);
  const items = useSplitStore((s) => s.items);
  const receiptId = useSplitStore((s) => s.receiptId);
  const setMerchant = useSplitStore((s) => s.setMerchant);
  const setTaxTip = useSplitStore((s) => s.setTaxTip);
  const updateItem = useSplitStore((s) => s.updateItem);
  const addItem = useSplitStore((s) => s.addItem);
  const removeItem = useSplitStore((s) => s.removeItem);
  const setReceiptId = useSplitStore((s) => s.setReceiptId);
  const imagePath = useSplitStore((s) => s.imagePath);

  const [loading, setLoading] = useState(false);

  const hasDraftItem = items.some((i) => !i.name.trim());
  const hasValidItems = items.some((i) => i.name.trim().length > 0);

  const ensureReceipt = async () => {
    if (receiptId || !user || !groupId) return receiptId;
    const receipt = await createReceipt(groupId, user.id, {
      image_path: imagePath,
      merchant,
      receipt_date: null,
      tax_cents: taxCents,
      tip_cents: tipCents,
    });
    setReceiptId(receipt.id);
    return receipt.id;
  };

  const continueToAssign = async () => {
    if (!hasValidItems) return;

    items
      .filter((i) => !i.name.trim())
      .forEach((i) => removeItem(i.id));

    setLoading(true);
    try {
      await ensureReceipt();
      router.push({
        pathname: '/(app)/split/assign',
        params: editing ? { groupId, editing: '1' } : { groupId },
      });
    } finally {
      setLoading(false);
    }
  };

  const addBlankItem = () => {
    if (hasDraftItem) return;
    addItem('', 0);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← back</Text>
        </Pressable>

        <Text style={styles.title}>
          {manual ? 'add your items' : 'looks right?'}
        </Text>
        <Text style={styles.sub}>
          {manual
            ? 'type what everyone ordered'
            : 'fix anything we misread, then assign'}
        </Text>

        <TextInput
          style={[styles.merchantInput, webInputReset]}
          placeholder="restaurant name"
          placeholderTextColor={colors.textMuted}
          value={merchant ?? ''}
          onChangeText={setMerchant}
          {...inputAccent}
        />

        <GlassCard>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              name={item.name}
              amountCents={item.amountCents}
              isDraft={!item.name.trim()}
              onUpdate={(patch) => updateItem(item.id, patch)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
          <Pressable onPress={addBlankItem} disabled={hasDraftItem}>
            <Text style={[styles.addLine, hasDraftItem && styles.addLineDisabled]}>
              + add item
            </Text>
          </Pressable>
        </GlassCard>

        <View style={styles.taxRow}>
          <View style={styles.taxField}>
            <Text style={styles.taxLabel}>tax</Text>
            <MoneyField
              cents={taxCents}
              onChangeCents={(c) => setTaxTip(c, tipCents)}
            />
          </View>
          <View style={styles.taxField}>
            <Text style={styles.taxLabel}>tip</Text>
            <MoneyField
              cents={tipCents}
              onChangeCents={(c) => setTaxTip(taxCents, c)}
            />
          </View>
        </View>

        <Text style={styles.total}>
          items: {formatCents(items.reduce((s, i) => s + i.amountCents, 0))}
        </Text>

        <Button
          label="assign to people →"
          onPress={continueToAssign}
          loading={loading}
          disabled={!hasValidItems}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  back: { ...typography.body, color: colors.primary },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.body, color: colors.textSecondary },
  merchantInput: {
    ...typography.body,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  remove: { fontSize: 22, color: colors.textMuted, padding: 4 },
  addLine: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  addLineDisabled: {
    color: colors.textMuted,
    opacity: 0.45,
  },
  taxRow: { flexDirection: 'row', gap: spacing.md },
  taxField: { flex: 1 },
  taxLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'none',
    fontSize: 13,
  },
  total: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
