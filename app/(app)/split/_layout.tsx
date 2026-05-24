import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function SplitLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.cream },
        animation: 'slide_from_right',
      }}
    />
  );
}
