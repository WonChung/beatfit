import { describe, expect, it } from '@jest/globals';

import type { GenerateWorkoutRequest, GenerateWorkoutResponse } from '@/types/workout';

import { initialWorkoutState, workoutReducer } from './workout-store';

const request: GenerateWorkoutRequest = {
  muscle_group: 'chest',
  difficulty: 'intermediate',
  equipment: ['bodyweight'],
  songs: [{ title: 'Song 1', artist: 'Test Artist', duration_ms: 225_000 }],
};

const workout: GenerateWorkoutResponse = {
  muscle_group: 'chest',
  difficulty: 'intermediate',
  equipment: ['bodyweight'],
  blocks: [],
};

describe('workoutReducer', () => {
  it('stores the original request with a generated workout', () => {
    expect(
      workoutReducer(initialWorkoutState, { type: 'save-generation', request, workout })
    ).toEqual({ request, workout });
  });

  it('replaces only the workout when regenerating', () => {
    const regenerated = { ...workout, difficulty: 'advanced' as const };
    const state = workoutReducer(
      { request, workout },
      { type: 'replace-workout', workout: regenerated }
    );

    expect(state.request).toBe(request);
    expect(state.workout).toBe(regenerated);
  });

  it('clears the current generation', () => {
    expect(workoutReducer({ request, workout }, { type: 'clear' })).toBe(initialWorkoutState);
  });
});
