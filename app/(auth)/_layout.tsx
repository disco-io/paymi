import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';
import { isProfileComplete } from '@/features/auth/profile';

export default function AuthLayout() {
  const { session, profile, paymentMethods, loading } = useAuth();

  if (loading) return null;
  if (session && isProfileComplete(profile, paymentMethods.length)) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
