import type { Session, User } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/services/supabase';

interface AuthState {
  session: Session | null;
  isRestoring: boolean;
}

export const initialAuthState: AuthState = { session: null, isRestoring: true };

export function restoredAuthState(session: Session | null): AuthState {
  return { session, isRestoring: false };
}

interface AuthContextValue extends AuthState {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured ? initialAuthState : restoredAuthState(null)
  );

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState(restoredAuthState(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState(restoredAuthState(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      user: state.session?.user ?? null,
      signIn: async (email, password) => {
        requireConfiguration();
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(toFriendlyAuthError(error.message));
      },
      signUp: async (email, password) => {
        requireConfiguration();
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(toFriendlyAuthError(error.message));
        return data.session === null;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
      },
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}

function requireConfiguration() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add the public Expo environment variables.');
  }
}

export function toFriendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (normalized.includes('email not confirmed')) return 'Confirm your email before signing in.';
  return message;
}
