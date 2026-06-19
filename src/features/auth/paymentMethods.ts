import { supabase } from '@/lib/supabase';
import type { PaymentProvider } from '@/lib/payment';
import type { PaymentMethod } from '@/types/database';

export type PaymentMethodInput = {
  provider: PaymentProvider;
  username: string;
};

export async function fetchPaymentMethods(profileId: string): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('profile_payment_methods')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.message.includes('profile_payment_methods')) return [];
    throw error;
  }
  return data ?? [];
}

export async function insertPaymentMethods(
  profileId: string,
  methods: PaymentMethodInput[]
) {
  if (methods.length === 0) return;

  const rows = methods.map((m) => ({
    profile_id: profileId,
    provider: m.provider,
    username: m.username.trim(),
  }));

  const { error } = await supabase.from('profile_payment_methods').insert(rows);
  if (error) throw error;
}

export async function replacePaymentMethods(
  profileId: string,
  methods: PaymentMethodInput[]
) {
  const { error: deleteError } = await supabase
    .from('profile_payment_methods')
    .delete()
    .eq('profile_id', profileId);

  if (deleteError) throw deleteError;
  await insertPaymentMethods(profileId, methods);
}
