import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { isSupabaseConfigured } from '@/lib/supabase';
import { logInWithPhone, signUpWithPhone } from '@/features/auth/phoneSignIn';
import { useAuth } from '@/features/auth/AuthContext';
import { toE164US } from '@/lib/phone';
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  paymentFieldLabel,
  type PaymentProvider,
} from '@/lib/payment';
import { isValidUsername, normalizeUsername, usernameValidationMessage } from '@/lib/username';
import { errorMessage, isMissingDbObjectError } from '@/lib/errors';
import { colors, spacing, typography, radius } from '@/theme';

type AuthMode = 'login' | 'signup';

type PaymentMethodDraft = {
  key: string;
  provider: PaymentProvider;
  username: string;
};

export default function PhoneScreen() {
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDraft[]>([]);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('venmo');
  const [paymentUsername, setPaymentUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPaymentMethod = () => {
    setError(null);
    const handle = paymentUsername.trim();
    if (!handle) {
      setError(`enter your ${paymentFieldLabel(paymentProvider).toLowerCase()}`);
      return;
    }
    const duplicate = paymentMethods.some(
      (m) =>
        m.provider === paymentProvider &&
        m.username.toLowerCase() === handle.toLowerCase()
    );
    if (duplicate) {
      setError('you already added that payment method');
      return;
    }
    setPaymentMethods((prev) => [
      ...prev,
      { key: `${paymentProvider}-${handle}-${Date.now()}`, provider: paymentProvider, username: handle },
    ]);
    setPaymentUsername('');
  };

  const removePaymentMethod = (key: string) => {
    setPaymentMethods((prev) => prev.filter((m) => m.key !== key));
  };

  const submit = async () => {
    setError(null);
    const e164 = toE164US(phone);
    const displayName = name.trim();
    const normalizedUsername = normalizeUsername(username);

    if (!e164) {
      setError('enter a valid 10-digit US number');
      return;
    }

    if (mode === 'signup') {
      if (!displayName) {
        setError('what should friends call you?');
        return;
      }
      if (!isValidUsername(normalizedUsername)) {
        setError(usernameValidationMessage());
        return;
      }
      if (paymentMethods.length === 0) {
        setError('add at least one payment method');
        return;
      }
    }

    if (!isSupabaseConfigured) {
      setError('add Supabase keys to .env (see README)');
      return;
    }

    setLoading(true);
    try {
      const user =
        mode === 'login'
          ? await logInWithPhone(e164)
          : await signUpWithPhone({
              phone: e164,
              displayName,
              username: normalizedUsername,
              paymentMethods: paymentMethods.map(({ provider, username: u }) => ({
                provider,
                username: u,
              })),
            });
      await refreshProfile(user.id);
      router.replace('/(app)');
    } catch (e) {
      const message = errorMessage(e);
      if (message.toLowerCase().includes('email signups disabled')) {
        setError('enable Email sign-in in Supabase (Authentication → Providers)');
      } else if (message.toLowerCase().includes('email not confirmed')) {
        setError('turn off email confirmation in Supabase (Authentication → Providers → Email)');
      } else if (isMissingDbObjectError(message)) {
        setError('database needs updating — run supabase db push (see README)');
      } else if (message.includes('profiles_username_lower_idx') || message.includes('duplicate key')) {
        setError('this username is taken — pick another');
      } else if (message.includes('profiles_phone_key')) {
        setError('this phone number is already registered — log in instead');
      } else {
        setError(message);
      }
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Logo />
          <Text style={styles.tagline}>split checks, not friendships</Text>

          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setMode('login')}
              style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>
                log in
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('signup')}
              style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>
                sign up
              </Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Input
              label="phone number"
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phone}
              onChangeText={setPhone}
              maxLength={14}
            />

            {mode === 'signup' ? (
              <>
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
                <Text style={styles.sectionSub}>add every way friends can pay you</Text>

                {paymentMethods.map((method) => (
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
                  placeholder={
                    paymentProvider === 'zelle' ? 'phone or email' : 'username'
                  }
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
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={mode === 'login' ? 'log in' : 'create account'}
              onPress={submit}
              loading={loading}
            />
            {!isSupabaseConfigured ? (
              <Text style={styles.configHint}>
                Supabase isn't configured yet. Add keys to .env (see README)
              </Text>
            ) : null}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeText: {
    ...typography.subtitle,
    fontSize: 15,
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.cream,
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
  sectionSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.sm,
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
  configHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
