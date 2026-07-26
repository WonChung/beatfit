import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { appleMusicService } from '@/services/apple-music';
import { spotifyMusicService } from '@/services/spotify';
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

interface DisconnectableMusicProvider {
  disconnect(): Promise<void>;
}

type AuthSignOut = () => Promise<{ error: { message: string } | null }>;

const MUSIC_PROVIDERS: readonly DisconnectableMusicProvider[] = [
  appleMusicService,
  spotifyMusicService,
];
const MUSIC_PROVIDER_DISCONNECT_TIMEOUT_MS = 2_000;

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured ? initialAuthState : restoredAuthState(null)
  );
  const currentUserId = useRef<string | null>(null);
  const explicitlyDisconnectedUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      return;
    }
    const restoration = new AuthSessionRestoration();
    const applySession = (session: Session | null) => {
      if (!active) return;
      const nextUserId = session?.user.id ?? null;
      if (shouldDisconnectMusicProviders(currentUserId.current, nextUserId)) {
        if (explicitlyDisconnectedUserId.current === currentUserId.current) {
          explicitlyDisconnectedUserId.current = null;
        } else {
          void disconnectMusicProviders();
        }
      }
      currentUserId.current = nextUserId;
      setState(restoredAuthState(session));
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      restoration.recordAuthEvent();
      applySession(session);
    });
    void supabase.auth
      .getSession()
      .then(({ data: sessionData }) => {
        if (restoration.shouldApplyRestoredSession()) applySession(sessionData.session);
      })
      .catch(() => {
        if (restoration.shouldApplyRestoredSession()) applySession(null);
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
        const departingUserId = currentUserId.current;
        explicitlyDisconnectedUserId.current = departingUserId;
        try {
          await signOutSession(() => supabase.auth.signOut(), MUSIC_PROVIDERS);
          if (currentUserId.current === departingUserId) {
            currentUserId.current = null;
            explicitlyDisconnectedUserId.current = null;
            setState(restoredAuthState(null));
          }
        } catch (error) {
          explicitlyDisconnectedUserId.current = null;
          throw error;
        }
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

export class AuthSessionRestoration {
  private receivedAuthEvent = false;

  recordAuthEvent() {
    this.receivedAuthEvent = true;
  }

  shouldApplyRestoredSession(): boolean {
    return !this.receivedAuthEvent;
  }
}

export function shouldDisconnectMusicProviders(
  previousUserId: string | null,
  nextUserId: string | null
): boolean {
  return previousUserId !== null && previousUserId !== nextUserId;
}

export async function disconnectMusicProviders(
  providers: readonly DisconnectableMusicProvider[] = MUSIC_PROVIDERS,
  timeoutMs = MUSIC_PROVIDER_DISCONNECT_TIMEOUT_MS
): Promise<void> {
  await Promise.all(
    providers.map((provider) =>
      settleProviderDisconnect(() => provider.disconnect(), timeoutMs)
    )
  );
}

export async function signOutSession(
  signOut: AuthSignOut,
  providers: readonly DisconnectableMusicProvider[] = MUSIC_PROVIDERS,
  disconnectTimeoutMs = MUSIC_PROVIDER_DISCONNECT_TIMEOUT_MS
): Promise<void> {
  await disconnectMusicProviders(providers, disconnectTimeoutMs);
  const { error } = await signOut();
  if (error) throw new Error(error.message);
}

function settleProviderDisconnect(
  disconnect: () => Promise<void>,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(finish, Math.max(0, timeoutMs));
    void Promise.resolve().then(disconnect).then(finish, finish);
  });
}
