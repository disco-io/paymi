import { useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/AuthContext';
import { createGroup, addMemberByPhone } from '@/features/groups/api';
import { toE164US, formatPhoneDisplay } from '@/lib/phone';
import { colors, spacing, typography, radius } from '@/theme';

const EMOJIS = ['✨', '🏝️', '🥐', '🏔️', '🎉', '🍕', '🛒', '💅'];

type PendingMember = { phone: string; label: string };

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [phoneInput, setPhoneInput] = useState('');
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMember = () => {
    const e164 = toE164US(phoneInput);
    if (!e164) {
      setError('enter a valid phone for your friend');
      return;
    }
    if (members.some((m) => m.phone === e164)) {
      setError('already added');
      return;
    }
    setMembers([...members, { phone: e164, label: formatPhoneDisplay(e164) }]);
    setPhoneInput('');
    setError(null);
  };

  const create = async () => {
    if (!name.trim()) {
      setError('give your group a name');
      return;
    }
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const group = await createGroup(name.trim(), emoji, user.id);
      for (const m of members) {
        await addMemberByPhone(group.id, m.phone, user.id);
      }
      router.replace(`/(app)/group/${group.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← back</Text>
          </Pressable>

          <Text style={styles.title}>new group</Text>

          <Input
            label="name"
            placeholder="Aruba spring break"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>vibe</Text>
          <View style={styles.emojiRow}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={[styles.emojiBtn, emoji === e && styles.emojiSelected]}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>add friends</Text>
          <View style={styles.addRow}>
            <View style={styles.phoneField}>
              <Input
                placeholder="friend's phone"
                keyboardType="phone-pad"
                value={phoneInput}
                onChangeText={setPhoneInput}
              />
            </View>
            <Button label="add" variant="secondary" onPress={addMember} style={styles.addBtn} />
          </View>

          {members.length > 0 && (
            <GlassCard>
              <FlatList
                scrollEnabled={false}
                data={members}
                keyExtractor={(m) => m.phone}
                renderItem={({ item }) => (
                  <View style={styles.memberRow}>
                    <Text style={styles.memberName}>{item.label}</Text>
                    <Pressable
                      onPress={() =>
                        setMembers(members.filter((x) => x.phone !== item.phone))
                      }
                    >
                      <Text style={styles.remove}>remove</Text>
                    </Pressable>
                  </View>
                )}
              />
            </GlassCard>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="create group" onPress={create} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  back: { marginBottom: spacing.sm },
  backText: {
    ...typography.body,
    color: colors.primary,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  emojiSelected: {
    backgroundColor: colors.primaryMuted,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  emojiText: { fontSize: 22 },
  section: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.md,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  phoneField: { flex: 1 },
  addBtn: { paddingHorizontal: 20, minHeight: 48 },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  memberName: { ...typography.body, color: colors.text },
  remove: { ...typography.caption, color: colors.danger },
  error: { ...typography.caption, color: colors.danger },
});
