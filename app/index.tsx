import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthContext';
import { isProfileComplete } from '@/features/auth/profile';
import { colors } from '@/theme';

export default function Index() {
  const { session, profile, paymentMethods, loading } = useAuth();

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

  if (!isProfileComplete(profile, paymentMethods.length)) {
    return <Redirect href="/(auth)/phone" />;
  }

  return <Redirect href="/(app)" />;
}
