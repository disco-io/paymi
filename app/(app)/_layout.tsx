import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';
import { isProfileComplete } from '@/features/auth/profile';

export default function AppLayout() {
  const { session, profile, paymentMethods, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/phone" />;
  if (!isProfileComplete(profile, paymentMethods.length)) return <Redirect href="/(auth)/phone" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
