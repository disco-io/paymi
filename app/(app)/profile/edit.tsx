import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthContext';
import { replacePaymentMethods } from '@/features/auth/paymentMethods';
import { isUsernameAvailable, updateProfile, uploadAvatar } from '@/features/profile/api';
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  paymentFieldLabel,
  type PaymentProvider,
} from '@/lib/payment';
import { isValidUsername, normalizeUsername, usernameValidationMessage } from '@/lib/username';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography, radius } from '@/theme';

type PaymentMethodDraft = {
  key: string;
  provider: PaymentProvider;
  username: string;
};

export default function EditProfileScreen() {
  const { profile, paymentMethods, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [methods, setMethods] = useState<PaymentMethodDraft[]>([]);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('venmo');
  const [paymentUsername, setPaymentUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? '');
    setUsername(profile.username ?? '');
    setAvatarUri(profile.avatar_url);
    setMethods(
      paymentMethods.map((m) => ({
        key: m.id,
        provider: (m.provider as PaymentProvider) || 'other',
        username: m.username,
      }))
    );
  }, [profile, paymentMethods]);

  const pickAvatar = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('allow photo access to set a profile picture');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const addPaymentMethod = () => {
    setError(null);
    const handle = paymentUsername.trim();
    if (!handle) {
      setError(`enter your ${paymentFieldLabel(paymentProvider).toLowerCase()}`);
      return;
    }
    const duplicate = methods.some(
      (m) =>
        m.provider === paymentProvider &&
        m.username.toLowerCase() === handle.toLowerCase()
    );
    if (duplicate) {
      setError('you already added that payment method');
      return;
    }
    setMethods((prev) => [
      ...prev,
      {
        key: `${paymentProvider}-${handle}-${Date.now()}`,
        provider: paymentProvider,
        username: handle,
      },
    ]);
    setPaymentUsername('');
  };

  const removePaymentMethod = (key: string) => {
    setMethods((prev) => prev.filter((m) => m.key !== key));
  };

  const save = async () => {
    if (!profile) return;
    setError(null);

    const displayName = name.trim();
    const normalizedUsername = normalizeUsername(username);

    if (!displayName) {
      setError('what should friends call you?');
      return;
    }
    if (!isValidUsername(normalizedUsername)) {
      setError(usernameValidationMessage());
      return;
    }
    if (methods.length === 0) {
      setError('keep at least one payment method');
      return;
    }

    const usernameOk = await isUsernameAvailable(normalizedUsername, profile.id);
    if (!usernameOk) {
      setError('this username is taken — pick another');
      return;
    }

    setLoading(true);
    try {
      let avatarUrl = profile.avatar_url;
      if (avatarUri && avatarUri !== profile.avatar_url) {
        if (avatarUri.startsWith('file://') || avatarUri.startsWith('content://')) {
          avatarUrl = await uploadAvatar(profile.id, avatarUri);
        } else {
          avatarUrl = avatarUri;
        }
      }

      await updateProfile(profile.id, {
        displayName,
        username: normalizedUsername,
        avatarUrl,
      });

      await replacePaymentMethods(
        profile.id,
        methods.map(({ provider, username: u }) => ({ provider, username: u }))
      );

      await refreshProfile(profile.id);
      router.replace(`/(app)/profile/${profile.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>sign in to edit your profile</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← cancel</Text>
          </Pressable>

          <Pressable onPress={pickAvatar} style={styles.avatarRow}>
            <Avatar name={name || profile.display_name || '?'} avatarUrl={avatarUri} size="lg" />
            <Text style={styles.changePhoto}>change photo</Text>
          </Pressable>

          <View style={styles.form}>
            <Input
              label="your name"
              placeholder="your name"
              autoCapitalize="words"
              autoComplete="name"
              value={name}
              onChangeText={setName}
            />
            <Input
              label="username"
              placeholder="username"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={(t) =>
                setUsername(t.replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, ''))
              }
              maxLength={24}
            />
            {username ? (
              <Text style={styles.usernamePreview}>@{normalizeUsername(username)}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>payment methods</Text>

            {methods.map((method) => (
              <View key={method.key} style={styles.methodRow}>
                <View style={styles.methodText}>
                  <Text style={styles.methodProvider}>
                    {PAYMENT_PROVIDER_LABELS[method.provider]}
                  </Text>
                  <Text style={styles.methodUsername}>{method.username}</Text>
                </View>
                <Pressable onPress={() => removePaymentMethod(method.key)} hitSlop={8}>
                  <Text style={styles.removeMethod}>remove</Text>
                </Pressable>
              </View>
            ))}

            <View style={styles.providerRow}>
              {PAYMENT_PROVIDERS.map((provider) => (
                <Pressable
                  key={provider}
                  onPress={() => setPaymentProvider(provider)}
                  style={[
                    styles.providerChip,
                    paymentProvider === provider && styles.providerChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.providerText,
                      paymentProvider === provider && styles.providerTextActive,
                    ]}
                  >
                    {PAYMENT_PROVIDER_LABELS[provider]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Input
              label={paymentFieldLabel(paymentProvider)}
              placeholder={paymentProvider === 'zelle' ? 'phone or email' : 'username'}
              autoCapitalize="none"
              autoCorrect={false}
              value={paymentUsername}
              onChangeText={setPaymentUsername}
            />
            <Button
              label="add payment method"
              variant="secondary"
              onPress={addPaymentMethod}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="save changes" onPress={save} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  back: { alignSelf: 'flex-start' },
  backText: {
    ...typography.body,
    color: colors.primary,
  },
  avatarRow: {
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  changePhoto: {
    ...typography.caption,
    color: colors.primary,
  },
  form: { gap: spacing.md },
  usernamePreview: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'none',
    fontSize: 13,
    marginTop: spacing.xs,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  methodText: { flex: 1, gap: 2 },
  methodProvider: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  methodUsername: {
    ...typography.body,
    color: colors.text,
  },
  removeMethod: {
    ...typography.caption,
    color: colors.primary,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  providerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  providerChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  providerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  providerTextActive: {
    color: colors.cream,
    fontWeight: '600',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
