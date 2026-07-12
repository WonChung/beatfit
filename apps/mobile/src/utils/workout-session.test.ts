import { describe, expect, it } from '@jest/globals';

import type { GenerateWorkoutResponse } from '@/types/workout';

import {
  calculateCompletionPercentage,
  createWorkoutSession,
  getCompletedBlocks,
  getCompletedIntervals,
  getPlannedVsActualDuration,
} from './workout-session';

const workout: GenerateWorkoutResponse = {
  muscle_group: 'legs',
  difficulty: 'advanced',
  equipment: ['dumbbells'],
  blocks: [
    {
      song: { title: 'One', artist: 'Artist', duration_ms: 20_000 },
      duration_seconds: 20,
      intervals: [
        { start_seconds: 0, end_seconds: 10, type: 'work', exercise: 'Squats' },
        { start_seconds: 10, end_seconds: 20, type: 'rest', exercise: 'Rest' },
      ],
    },
    {
      song: { title: 'Two', artist: 'Artist', duration_ms: 10_000 },
      duration_seconds: 10,
      intervals: [
        { start_seconds: 0, end_seconds: 10, type: 'work', exercise: 'Lunges' },
      ],
    },
  ],
};

describe('completed workout sessions', () => {
  it('creates a complete summary for every interval and block', () => {
    const session = createWorkoutSession({
      workout,
      startTimeMs: 1000,
      endTimeMs: 31_000,
      completedIndices: [0, 1, 2],
      status: 'completed',
      id: 'complete-session',
    });

    expect(session).toMatchObject({
      id: 'complete-session',
      plannedDurationSeconds: 30,
      actualElapsedDurationSeconds: 30,
      totalIntervals: 3,
      completedIntervals: 3,
      completedWorkIntervals: 2,
      completedSongBlocks: 2,
      status: 'completed',
    });
    expect(calculateCompletionPercentage(session.completedIntervals, session.totalIntervals)).toBe(
      100
    );
    expect(getPlannedVsActualDuration(session)).toEqual({
      differenceSeconds: 0,
      actualToPlannedPercentage: 100,
    });
  });
});

describe('ended-early workout sessions', () => {
  it('handles ending before the first interval completes', () => {
    const session = createWorkoutSession({
      workout,
      startTimeMs: 5000,
      endTimeMs: 5000,
      completedIndices: [],
      status: 'ended_early',
      id: 'early-session',
    });

    expect(session.completedIntervals).toBe(0);
    expect(session.completedWorkIntervals).toBe(0);
    expect(session.completedSongBlocks).toBe(0);
    expect(session.actualElapsedDurationSeconds).toBe(0);
    expect(calculateCompletionPercentage(0, session.totalIntervals)).toBe(0);
  });

  it('counts only fully completed intervals and blocks', () => {
    expect(getCompletedIntervals(workout, [0, 1])).toHaveLength(2);
    expect(getCompletedBlocks(workout, [0, 1])).toBe(1);
    expect(getCompletedBlocks(workout, [0])).toBe(0);
  });

  it('handles empty and zero-duration workouts', () => {
    const emptyWorkout = { ...workout, blocks: [] };
    const session = createWorkoutSession({
      workout: emptyWorkout,
      startTimeMs: 1000,
      endTimeMs: 1000,
      completedIndices: [],
      status: 'ended_early',
    });

    expect(session.plannedDurationSeconds).toBe(0);
    expect(session.totalIntervals).toBe(0);
    expect(calculateCompletionPercentage(0, 0)).toBe(0);
    expect(getPlannedVsActualDuration(session).actualToPlannedPercentage).toBe(0);
  });
});
