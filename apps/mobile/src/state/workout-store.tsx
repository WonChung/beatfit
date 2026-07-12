import { createContext, type PropsWithChildren, useContext, useMemo, useReducer } from 'react';

import type { GenerateWorkoutRequest, GenerateWorkoutResponse } from '@/types/workout';

export interface WorkoutState {
  request: GenerateWorkoutRequest | null;
  workout: GenerateWorkoutResponse | null;
}

export const initialWorkoutState: WorkoutState = {
  request: null,
  workout: null,
};

export type WorkoutAction =
  | {
      type: 'save-generation';
      request: GenerateWorkoutRequest;
      workout: GenerateWorkoutResponse;
    }
  | { type: 'replace-workout'; workout: GenerateWorkoutResponse }
  | { type: 'clear' };

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'save-generation':
      return { request: action.request, workout: action.workout };
    case 'replace-workout':
      return { ...state, workout: action.workout };
    case 'clear':
      return initialWorkoutState;
  }
}

interface WorkoutContextValue extends WorkoutState {
  saveGeneration: (
    request: GenerateWorkoutRequest,
    workout: GenerateWorkoutResponse
  ) => void;
  replaceWorkout: (workout: GenerateWorkoutResponse) => void;
  clearWorkout: () => void;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(workoutReducer, initialWorkoutState);
  const value = useMemo<WorkoutContextValue>(
    () => ({
      ...state,
      saveGeneration: (request, workout) =>
        dispatch({ type: 'save-generation', request, workout }),
      replaceWorkout: (workout) => dispatch({ type: 'replace-workout', workout }),
      clearWorkout: () => dispatch({ type: 'clear' }),
    }),
    [state]
  );

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkoutStore(): WorkoutContextValue {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkoutStore must be used within a WorkoutProvider.');
  }
  return context;
}
