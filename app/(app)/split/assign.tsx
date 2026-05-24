import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { MemberChip } from '@/components/MemberChip';
import { useSplitStore } from '@/features/split/splitStore';
import {
  assignEveryone,
  formatCents,
  toggleAssignee,
} from '@/features/split/splitMath';
import { colors, spacing, typography } from '@/theme';

export default function AssignScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const people = useSplitStore((s) => s.people);
  const items = useSplitStore((s) => s.items);
  const setItemAssignments = useSplitStore((s) => s.setItemAssignments);
  const [activeMember, setActiveMember] = useState<string | null>(
    people[0]?.id ?? null
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    items[0]?.id ?? null
  );

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const assignToActive = (itemId: string) => {
    if (!activeMember) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    Haptics.selectionAsync();
    const next = toggleAssignee(item.assignments, activeMember);
    setItemAssignments(itemId, next);
    setSelectedItemId(itemId);
  };

  const assignEveryoneToItem = (itemId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setItemAssignments(
      itemId,
      assignEveryone(people.map((p) => p.id))
    );
    setSelectedItemId(itemId);
  };

  const assignedCount = items.filter(
    (i) => Object.keys(i.assignments).length > 0
  ).length;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← review</Text>
        </Pressable>
        <Text style={styles.title}>who got what?</Text>
        <Text style={styles.sub}>
          tap a person, then tap items · {assignedCount}/{items.length} assigned
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.peopleRow}
      >
        {people.map((p) => (
          <MemberChip
            key={p.id}
            label={p.label}
            selected={activeMember === p.id}
            onPress={() => setActiveMember(p.id)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const assignees = Object.keys(item.assignments);
          const labels = assignees
            .map((id) => people.find((p) => p.id === id)?.label)
            .filter(Boolean);

          return (
            <Pressable
              onPress={() => assignToActive(item.id)}
              onLongPress={() => assignEveryoneToItem(item.id)}
            >
              <GlassCard
                style={[
                  styles.itemCard,
                  selectedItemId === item.id && styles.itemCardActive,
                ]}
              >
                <View style={styles.itemTop}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>
                    {formatCents(item.amountCents)}
                  </Text>
                </View>
                <Text style={styles.assignees}>
                  {labels.length > 0
                    ? labels.join(' · ')
                    : 'tap to assign · hold for everyone'}
                </Text>
              </GlassCard>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Button
          label="see totals →"
          onPress={() =>
            router.push({ pathname: '/(app)/split/summary', params: { groupId } })
          }
          disabled={assignedCount < items.length}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  back: { ...typography.body, color: colors.primary, marginBottom: spacing.sm },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  peopleRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  itemCard: { marginBottom: 0 },
  itemCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemName: { ...typography.subtitle, color: colors.text, flex: 1 },
  itemPrice: { ...typography.subtitle, color: colors.primaryDark },
  assignees: { ...typography.caption, color: colors.textSecondary },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
