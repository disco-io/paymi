import { useState } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useDevPreview } from '@/features/dev/devPreview';
import { toE164US } from '@/lib/phone';
import { colors, spacing, typography } from '@/theme';

export default function PhoneScreen() {
  const enablePreview = useDevPreview((s) => s.enable);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPreview = () => {
    enablePreview();
    router.replace('/(app)');
  };

  const sendCode = async () => {
    setError(null);
    const e164 = toE164US(phone);
    if (!e164) {
      setError('enter a valid 10-digit US number');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('add Supabase keys to .env — see README');
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOtp({ phone: e164 });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push({ pathname: '/(auth)/verify', params: { phone: e164 } });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Logo />
          <Text style={styles.tagline}>split the check, keep the vibe</Text>

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
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="send code" onPress={sendCode} loading={loading} />
            {!isSupabaseConfigured ? (
              <>
                <Text style={styles.configHint}>
                  Supabase isn't configured yet — add keys to .env (see README)
                </Text>
                <Button
                  label="preview app UI"
                  variant="secondary"
                  onPress={startPreview}
                />
              </>
            ) : null}
          </View>

          <Text style={styles.hint}>we'll text you a code — no password needed</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.md,
  },
  form: { gap: spacing.md, marginTop: spacing.xl },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  configHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
