import { describe, expect, it } from '@jest/globals';

import type {
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
  WorkoutSession,
} from '@/types/workout';

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

const session: WorkoutSession = {
  id: 'session-1',
  workout,
  startTime: new Date(0).toISOString(),
  endTime: new Date(1000).toISOString(),
  plannedDurationSeconds: 0,
  actualElapsedDurationSeconds: 1,
  totalIntervals: 0,
  completedIntervals: 0,
  completedWorkIntervals: 0,
  completedSongBlocks: 0,
  status: 'ended_early',
};

describe('workoutReducer', () => {
  it('stores the original request with a generated workout', () => {
    expect(
      workoutReducer(initialWorkoutState, { type: 'save-generation', request, workout })
    ).toEqual({ request, workout, session: null, selectedSongs: [] });
  });

  it('replaces only the workout when regenerating', () => {
    const regenerated = { ...workout, difficulty: 'advanced' as const };
    const state = workoutReducer(
      { request, workout, session, selectedSongs: [] },
      { type: 'replace-workout', workout: regenerated }
    );

    expect(state.request).toBe(request);
    expect(state.workout).toBe(regenerated);
    expect(state.session).toBeNull();
  });

  it('stores a completed session and updates its feedback', () => {
    const withSession = workoutReducer(
      { request, workout, session: null, selectedSongs: [] },
      { type: 'save-session', session }
    );
    const withFeedback = workoutReducer(withSession, {
      type: 'set-feedback',
      feedback: 'about_right',
    });

    expect(withFeedback.session?.feedback).toBe('about_right');
    expect(withFeedback.workout).toBe(workout);
  });

  it('clears a session without clearing the reusable workout', () => {
    const state = workoutReducer(
      { request, workout, session, selectedSongs: [] },
      { type: 'clear-session' }
    );
    expect(state).toEqual({ request, workout, session: null, selectedSongs: [] });
  });

  it('clears the current generation', () => {
    expect(workoutReducer({ request, workout, session, selectedSongs: [] }, { type: 'clear' })).toBe(
      initialWorkoutState
    );
  });
});
