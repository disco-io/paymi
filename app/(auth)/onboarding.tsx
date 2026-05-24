import { useState } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme';

export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('what should friends call you?');
      return;
    }
    if (!user) return;

    setLoading(true);
    const phone = user.phone ?? null;

    const { error: upErr } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        display_name: trimmed,
        phone,
      });

    setLoading(false);

    if (upErr) {
      setError(upErr.message);
      return;
    }

    await refreshProfile();
    router.replace('/(app)');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>what's your name?</Text>
          <Text style={styles.sub}>this is how you'll show up in splits</Text>

          <Input
            placeholder="delphia"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="let's go" onPress={save} loading={loading} />
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
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
