import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { formatPhoneDisplay } from '@/lib/phone';
import { colors, spacing, typography, radius } from '@/theme';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!phone || code.length < 6) {
      setError('enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.replace('/');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>enter your code</Text>
          <Text style={styles.sub}>
            sent to {phone ? formatPhoneDisplay(phone) : 'your phone'}
          </Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="continue" onPress={verify} loading={loading} />

          <Button
            label="back"
            variant="ghost"
            onPress={() => router.back()}
          />
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
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  codeInput: {
    ...typography.hero,
    fontSize: 36,
    letterSpacing: 12,
    textAlign: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    color: colors.text,
    marginVertical: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
