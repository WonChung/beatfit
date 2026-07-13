import { afterEach, describe, expect, it, jest } from '@jest/globals';

import type { GenerateWorkoutRequest, WorkoutSession } from '@/types/workout';

import {
  generatePersonalizedWorkout,
  persistWorkoutSessionFeedback,
  resetPersonalization,
  toRemoteWorkoutSessionCreate,
} from './api';

const request: GenerateWorkoutRequest = {
  muscle_group: 'core',
  difficulty: 'intermediate',
  equipment: ['bodyweight'],
  goal: 'endurance',
  songs: [{ title: 'Song', artist: 'Artist', duration_ms: 60_000 }],
};

const workout = {
  workout_id: 'workout-id',
  muscle_group: 'core' as const,
  difficulty: 'intermediate' as const,
  equipment: ['bodyweight' as const],
  goal: 'endurance' as const,
  blocks: [],
};

const session: WorkoutSession = {
  id: 'local-session',
  workout,
  startTime: '2026-07-01T00:00:00.000Z',
  endTime: '2026-07-01T00:01:00.000Z',
  plannedDurationSeconds: 60,
  actualElapsedDurationSeconds: 59.6,
  totalIntervals: 5,
  completedIntervals: 4,
  completedWorkIntervals: 2,
  completedSongBlocks: 0,
  status: 'ended_early',
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('authenticated personalization API', () => {
  it('sends a bearer token to the personalized generator', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(mockResponse(workout));

    await expect(generatePersonalizedWorkout(request, 'access-token')).resolves.toEqual(workout);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/workouts/generate/personalized'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      })
    );
  });

  it('uses the authenticated reset endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse({}));

    await resetPersonalization('access-token');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/user-preferences/reset'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      })
    );
  });

  it('maps local session metrics to the persistence API contract', () => {
    expect(toRemoteWorkoutSessionCreate('workout-id', session)).toEqual({
      workout_id: 'workout-id',
      started_at: session.startTime,
      ended_at: session.endTime,
      actual_elapsed_seconds: 60,
      completed_intervals: 4,
      completed_work_intervals: 2,
      completed_song_blocks: 0,
      status: 'ended_early',
    });
  });

  it('patches feedback using the server session ID', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse({ id: 'remote' }));

    await persistWorkoutSessionFeedback('remote', 'too_hard', 'access-token');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/workout-sessions/remote'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ feedback: { rating: 'too_hard' } }),
      })
    );
  });
});

function mockResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
