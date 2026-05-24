import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthContext';
import { useDevPreview } from '@/features/dev/devPreview';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors } from '@/theme';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const devPreview = useDevPreview((s) => s.enabled);

  if (devPreview && !isSupabaseConfigured) {
    return <Redirect href="/(app)" />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/phone" />;
  }

  if (!profile?.display_name) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(app)" />;
}
