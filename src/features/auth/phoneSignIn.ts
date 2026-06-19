import { supabase } from '@/lib/supabase';
import { isProfileComplete } from '@/features/auth/profile';
import { isMissingDbObjectError } from '@/lib/errors';
import { normalizeUsername } from '@/lib/username';
import {
  fetchPaymentMethods,
  insertPaymentMethods,
  type PaymentMethodInput,
} from '@/features/auth/paymentMethods';

export type SignUpFields = {
  phone: string;
  displayName: string;
  username: string;
  paymentMethods: PaymentMethodInput[];
};

function credentialsForPhone(e164: string) {
  const digits = e164.replace(/\D/g, '');
  const password = `paymi-dev-${digits}`;
  return {
    email: `user+${digits}@paymi.app`,
    legacyEmail: `user+${digits}@paymi.invalid`,
    password,
  };
}

async function signInWithPhoneCredentials(e164: string) {
  const { email, legacyEmail, password } = credentialsForPhone(e164);
  const primary = await supabase.auth.signInWithPassword({ email, password });
  if (primary.data.user) return primary;
  return supabase.auth.signInWithPassword({ email: legacyEmail, password });
}

export async function checkSignupAvailable(phone: string, username: string) {
  const { data, error } = await supabase.rpc('check_signup_available', {
    p_phone: phone,
    p_username: normalizeUsername(username),
  });

  if (error) {
    if (isMissingDbObjectError(error.message)) {
      return 'ok' as const;
    }
    throw error;
  }
  return data as 'ok' | 'phone_taken' | 'username_taken';
}

async function hasCompleteAccount(userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  const paymentMethods = await fetchPaymentMethods(userId);
  return isProfileComplete(profile, paymentMethods.length);
}

async function saveProfile(userId: string, fields: SignUpFields) {
  const username = normalizeUsername(fields.username);

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    phone: fields.phone,
    display_name: fields.displayName.trim(),
    username,
  });

  if (profileError) {
    if (profileError.message.includes('profiles_phone_key')) {
      throw new Error('this phone number is already registered — log in instead');
    }
    if (
      profileError.message.includes('profiles_username_lower_idx') ||
      profileError.message.includes('duplicate key')
    ) {
      throw new Error('this username is taken — pick another');
    }
    throw profileError;
  }

  const existingMethods = await fetchPaymentMethods(userId);
  if (existingMethods.length === 0) {
    await insertPaymentMethods(userId, fields.paymentMethods);
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      phone: fields.phone,
      display_name: fields.displayName.trim(),
      username,
    },
  });
  if (metaError) throw metaError;
}

async function finishSignUp(fields: SignUpFields) {
  const { email, password } = credentialsForPhone(fields.phone);

  const created = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone: fields.phone,
        display_name: fields.displayName.trim(),
        username: normalizeUsername(fields.username),
      },
    },
  });

  if (created.error) {
    const msg = created.error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      const signIn = await signInWithPhoneCredentials(fields.phone);
      if (!signIn.data.user) {
        throw new Error('you already have an account — log in instead');
      }
      if (await hasCompleteAccount(signIn.data.user.id)) {
        throw new Error('you already have an account — log in instead');
      }
      await saveProfile(signIn.data.user.id, fields);
      return signIn.data.user;
    }
    throw created.error;
  }

  const user = created.data.user;
  if (!user) throw new Error('account creation failed');

  if (!created.data.session) {
    const retry = await signInWithPhoneCredentials(fields.phone);
    if (retry.error || !retry.data.user) {
      throw new Error(
        'account created but sign-in failed — turn off email confirmation in Supabase'
      );
    }
    await saveProfile(retry.data.user.id, fields);
    return retry.data.user;
  }

  await saveProfile(user.id, fields);
  return user;
}

export async function logInWithPhone(e164: string) {
  const { data, error } = await signInWithPhoneCredentials(e164);

  if (error || !data.user) {
    throw new Error('no account with this number — sign up instead');
  }

  if (!(await hasCompleteAccount(data.user.id))) {
    throw new Error('finish setting up your account — use sign up with the same number');
  }

  return data.user;
}

export async function signUpWithPhone(fields: SignUpFields) {
  if (fields.paymentMethods.length === 0) {
    throw new Error('add at least one payment method');
  }

  const availability = await checkSignupAvailable(fields.phone, fields.username);
  if (availability === 'phone_taken') {
    const signIn = await signInWithPhoneCredentials(fields.phone);
    if (signIn.data.user && !(await hasCompleteAccount(signIn.data.user.id))) {
      await saveProfile(signIn.data.user.id, fields);
      return signIn.data.user;
    }
    throw new Error('this phone number is already registered — log in instead');
  }
  if (availability === 'username_taken') {
    throw new Error('this username is taken — pick another');
  }

  return finishSignUp(fields);
}
