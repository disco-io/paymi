import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useSplitStore } from '@/features/split/splitStore';
import { useAuth } from '@/features/auth/AuthContext';
import { createReceipt } from '@/features/receipt/api';
import { formatCents } from '@/features/split/splitMath';
import { colors, spacing, typography, radius } from '@/theme';

export default function ReviewScreen() {
  const { groupId, manual } = useLocalSearchParams<{ groupId: string; manual?: string }>();
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

  useEffect(() => {
    if (manual && items.length === 0) {
      addItem('Item 1', 0);
    }
  }, [manual]);

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
    if (items.length === 0) return;
    setLoading(true);
    try {
      await ensureReceipt();
      router.push({ pathname: '/(app)/split/assign', params: { groupId } });
    } finally {
      setLoading(false);
    }
  };

  const addBlankItem = () => {
    addItem('New item', 0);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← back</Text>
        </Pressable>

        <Text style={styles.title}>
          {manual ? 'add your items' : 'looks right?'}
        </Text>
        <Text style={styles.sub}>
          {manual
            ? 'type what everyone ordered'
            : 'fix anything we misread — then assign'}
        </Text>

        <TextInput
          style={styles.merchantInput}
          placeholder="restaurant name"
          placeholderTextColor={colors.textMuted}
          value={merchant ?? ''}
          onChangeText={setMerchant}
        />

        <GlassCard>
          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <TextInput
                style={styles.itemName}
                value={item.name}
                onChangeText={(t) => updateItem(item.id, { name: t })}
              />
              <View style={styles.priceWrap}>
                <Text style={styles.dollar}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  keyboardType="decimal-pad"
                  value={(item.amountCents / 100).toFixed(2)}
                  onChangeText={(t) => {
                    const n = parseFloat(t.replace(/[^0-9.]/g, '')) || 0;
                    updateItem(item.id, { amountCents: Math.round(n * 100) });
                  }}
                />
              </View>
              <Pressable onPress={() => removeItem(item.id)}>
                <Text style={styles.remove}>×</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addBlankItem}>
            <Text style={styles.addLine}>+ add item</Text>
          </Pressable>
        </GlassCard>

        <View style={styles.taxRow}>
          <View style={styles.taxField}>
            <Text style={styles.taxLabel}>tax</Text>
            <TextInput
              style={styles.taxInput}
              keyboardType="decimal-pad"
              value={(taxCents / 100).toFixed(2)}
              onChangeText={(t) => {
                const n = parseFloat(t) || 0;
                setTaxTip(Math.round(n * 100), tipCents);
              }}
            />
          </View>
          <View style={styles.taxField}>
            <Text style={styles.taxLabel}>tip</Text>
            <TextInput
              style={styles.taxInput}
              keyboardType="decimal-pad"
              value={(tipCents / 100).toFixed(2)}
              onChangeText={(t) => {
                const n = parseFloat(t) || 0;
                setTaxTip(taxCents, Math.round(n * 100));
              }}
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
          disabled={items.length === 0}
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
    ...typography.subtitle,
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
  priceWrap: { flexDirection: 'row', alignItems: 'center' },
  dollar: { ...typography.body, color: colors.textMuted },
  priceInput: {
    width: 64,
    ...typography.body,
    color: colors.text,
    textAlign: 'right',
  },
  remove: { fontSize: 22, color: colors.textMuted, padding: 4 },
  addLine: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  taxRow: { flexDirection: 'row', gap: spacing.md },
  taxField: { flex: 1 },
  taxLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 4 },
  taxInput: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    color: colors.text,
  },
  total: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
