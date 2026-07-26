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
  createBeatFitRepository,
  type BeatFitRepository,
} from '@/storage/beatfit-repository';
import type { BeatFitStorageSchema, SavedWorkout } from '@/types/persistence';
import type {
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
  WorkoutFeedback,
  WorkoutSession,
} from '@/types/workout';

const EMPTY_DATABASE: BeatFitStorageSchema = {
  version: 1,
  generatedWorkouts: [],
  savedWorkouts: [],
  sessions: [],
};

interface PersistenceContextValue extends BeatFitStorageSchema {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  recordGeneratedWorkout: (
    request: GenerateWorkoutRequest,
    workout: GenerateWorkoutResponse
  ) => Promise<void>;
  saveNamedWorkout: (
    name: string,
    request: GenerateWorkoutRequest,
    workout: GenerateWorkoutResponse
  ) => Promise<SavedWorkout>;
  renameSavedWorkout: (id: string, name: string) => Promise<void>;
  toggleSavedWorkoutFavorite: (id: string) => Promise<void>;
  deleteSavedWorkout: (id: string) => Promise<void>;
  recordSession: (session: WorkoutSession) => Promise<void>;
  persistSessionFeedback: (id: string, feedback: WorkoutFeedback) => Promise<void>;
  clearError: () => void;
}

const PersistenceContext = createContext<PersistenceContextValue | null>(null);

export function PersistenceProvider({
  children,
  userId,
  repository,
}: PropsWithChildren<{ userId: string; repository?: BeatFitRepository }>) {
  const activeRepository = useMemo(
    () => repository ?? createBeatFitRepository(userId),
    [repository, userId]
  );
  const [database, setDatabase] = useState<BeatFitStorageSchema>(EMPTY_DATABASE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDatabase(await activeRepository.read());
      setError(null);
    } catch (caughtError) {
      setError(toErrorMessage(caughtError));
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, [activeRepository]);

  useEffect(() => {
    let isActive = true;
    activeRepository
      .read()
      .then((storedDatabase) => {
        if (isActive) {
          setDatabase(storedDatabase);
          setError(null);
        }
      })
      .catch((caughtError) => {
        if (isActive) setError(toErrorMessage(caughtError));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [activeRepository]);

  const runMutation = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      try {
        const result = await operation();
        setDatabase(await activeRepository.read());
        setError(null);
        return result;
      } catch (caughtError) {
        setError(toErrorMessage(caughtError));
        throw caughtError;
      }
    },
    [activeRepository]
  );

  const value = useMemo<PersistenceContextValue>(
    () => ({
      ...database,
      isLoading,
      error,
      refresh,
      recordGeneratedWorkout: async (request, workout) => {
        await runMutation(() => activeRepository.addGeneratedWorkout(request, workout));
      },
      saveNamedWorkout: (name, request, workout) =>
        runMutation(() => activeRepository.saveWorkout(name, request, workout)),
      renameSavedWorkout: async (id, name) => {
        await runMutation(() => activeRepository.renameWorkout(id, name));
      },
      toggleSavedWorkoutFavorite: async (id) => {
        await runMutation(() => activeRepository.toggleFavorite(id));
      },
      deleteSavedWorkout: async (id) => {
        await runMutation(() => activeRepository.deleteWorkout(id));
      },
      recordSession: async (session) => {
        await runMutation(() => activeRepository.saveSession(session));
      },
      persistSessionFeedback: async (id, feedback) => {
        await runMutation(() => activeRepository.updateSessionFeedback(id, feedback));
      },
      clearError: () => setError(null),
    }),
    [activeRepository, database, error, isLoading, refresh, runMutation]
  );

  return <PersistenceContext.Provider value={value}>{children}</PersistenceContext.Provider>;
}

export function usePersistenceStore(): PersistenceContextValue {
  const context = useContext(PersistenceContext);
  if (!context) throw new Error('usePersistenceStore must be used within a PersistenceProvider.');
  return context;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Local storage operation failed.';
}
