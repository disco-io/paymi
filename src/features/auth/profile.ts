import type { Profile } from '@/types/database';

export function isProfileComplete(
  profile: Profile | null | undefined,
  paymentMethodCount: number
) {
  return Boolean(
    profile?.display_name?.trim() &&
      profile?.username?.trim() &&
      profile?.phone?.trim() &&
      paymentMethodCount > 0
  );
}
