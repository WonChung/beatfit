import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getUserPreferences,
  resetPersonalization as resetPersonalizationApi,
  updateUserPreferences,
} from '@/services/api';
import { useAuth } from '@/state/auth-store';
import type { UserPreferences, UserPreferencesUpdate } from '@/types/workout';

interface PreferencesContextValue {
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  save: (value: UserPreferencesUpdate) => Promise<UserPreferences>;
  resetPersonalization: () => Promise<UserPreferences>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(accessToken));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accessToken) {
      setPreferences(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setPreferences(await getUserPreferences(accessToken));
      setLoadedToken(accessToken);
    } catch (caughtError) {
      setError(toMessage(caughtError, 'Could not load preferences.'));
      setLoadedToken(accessToken);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void getUserPreferences(accessToken)
      .then((loadedPreferences) => {
        if (!active) return;
        setPreferences(loadedPreferences);
        setLoadedToken(accessToken);
        setError(null);
        setIsLoading(false);
      })
      .catch((caughtError) => {
        if (!active) return;
        setPreferences(null);
        setLoadedToken(accessToken);
        setError(toMessage(caughtError, 'Could not load preferences.'));
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const currentPreferences = loadedToken === accessToken ? preferences : null;
  const currentError = loadedToken === accessToken ? error : null;
  const currentlyLoading = Boolean(accessToken && loadedToken !== accessToken) || isLoading;

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences: currentPreferences,
      isLoading: currentlyLoading,
      error: currentError,
      reload,
      save: async (nextPreferences) => {
        if (!accessToken) throw new Error('Sign in to save preferences.');
        const saved = await updateUserPreferences(nextPreferences, accessToken);
        setPreferences(saved);
        setLoadedToken(accessToken);
        setError(null);
        return saved;
      },
      resetPersonalization: async () => {
        if (!accessToken) throw new Error('Sign in to reset personalization.');
        const reset = await resetPersonalizationApi(accessToken);
        setPreferences(reset);
        setLoadedToken(accessToken);
        setError(null);
        return reset;
      },
    }),
    [accessToken, currentError, currentPreferences, currentlyLoading, reload]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used within PreferencesProvider.');
  return value;
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
