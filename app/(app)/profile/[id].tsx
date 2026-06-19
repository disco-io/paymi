import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/AuthContext';
import { fetchPaymentMethods } from '@/features/auth/paymentMethods';
import { fetchProfileById } from '@/features/profile/api';
import { formatUsernameDisplay } from '@/lib/username';
import { PAYMENT_PROVIDER_LABELS, isPaymentProvider } from '@/lib/payment';
import type { PaymentMethod, Profile } from '@/types/database';
import { colors, spacing, typography } from '@/theme';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: myProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = Boolean(id && myProfile?.id === id);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [p, methods] = await Promise.all([
        fetchProfileById(id),
        fetchPaymentMethods(id),
      ]);
      if (!p) {
        setError('profile not found');
        setProfile(null);
        setPaymentMethods([]);
        return;
      }
      setProfile(p);
      setPaymentMethods(methods);
    } catch {
      setError('could not load profile');
      setProfile(null);
      setPaymentMethods([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const displayName = profile?.display_name?.trim() || 'someone';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← back</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : profile ? (
          <>
            <View style={styles.hero}>
              <Avatar
                name={displayName}
                avatarUrl={profile.avatar_url}
                size="lg"
              />
              <Text style={styles.name}>{displayName}</Text>
              {profile.username ? (
                <Text style={styles.username}>
                  {formatUsernameDisplay(profile.username)}
                </Text>
              ) : null}
            </View>

            {isOwnProfile ? (
              <Button
                label="edit profile"
                variant="secondary"
                onPress={() => router.push('/(app)/profile/edit')}
              />
            ) : null}

            <Text style={styles.section}>payment methods</Text>
            {paymentMethods.length > 0 ? (
              <View style={styles.methods}>
                {paymentMethods.map((method) => {
                  const provider = isPaymentProvider(method.provider)
                    ? method.provider
                    : 'other';
                  return (
                    <GlassCard key={method.id}>
                      <Text style={styles.methodProvider}>
                        {PAYMENT_PROVIDER_LABELS[provider]}
                      </Text>
                      <Text style={styles.methodUsername}>{method.username}</Text>
                    </GlassCard>
                  );
                })}
              </View>
            ) : (
              <GlassCard>
                <Text style={styles.emptyMethods}>
                  {isOwnProfile
                    ? 'add a payment method so friends know how to pay you'
                    : 'payment methods are only visible when you share a group'}
                </Text>
              </GlassCard>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  back: { marginBottom: spacing.sm },
  backText: {
    ...typography.body,
    color: colors.primary,
  },
  loader: { marginTop: spacing.xl },
  error: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  name: {
    ...typography.title,
    fontSize: 24,
    color: colors.text,
  },
  username: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'none',
    fontSize: 13,
    marginTop: spacing.md,
  },
  methods: { gap: spacing.sm },
  methodProvider: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  methodUsername: {
    ...typography.body,
    color: colors.text,
    marginTop: 4,
  },
  emptyMethods: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
