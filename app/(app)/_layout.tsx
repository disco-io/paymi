import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';
import { isDevPreviewActive } from '@/features/dev/devPreview';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function AppLayout() {
  const { session, profile, loading } = useAuth();
  const preview = isDevPreviewActive() && !isSupabaseConfigured;

  if (loading && !preview) return null;
  if (!preview) {
    if (!session) return <Redirect href="/(auth)/phone" />;
    if (!profile?.display_name) return <Redirect href="/(auth)/onboarding" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
