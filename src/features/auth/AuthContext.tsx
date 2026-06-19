import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import type { PaymentMethod, Profile } from '@/types/database';
import { fetchPaymentMethods } from '@/features/auth/paymentMethods';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  paymentMethods: PaymentMethod[];
  loading: boolean;
  refreshProfile: (userId?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const [{ data: profileData }, methods] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      fetchPaymentMethods(userId),
    ]);
    setProfile(profileData);
    setPaymentMethods(methods);
    return profileData;
  }, []);

  const refreshProfile = useCallback(
    async (userId?: string) => {
      const id = userId ?? session?.user?.id;
      if (id) await fetchProfile(id);
    },
    [session?.user?.id, fetchProfile]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile(session.user.id);
    } else {
      setProfile(null);
      setPaymentMethods([]);
    }
  }, [session?.user?.id, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPaymentMethods([]);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      paymentMethods,
      loading,
      refreshProfile,
      signOut,
    }),
    [session, profile, paymentMethods, loading, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
