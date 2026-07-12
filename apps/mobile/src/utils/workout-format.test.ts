import { describe, expect, it } from '@jest/globals';

import type { GenerateWorkoutResponse } from '@/types/workout';

import {
  formatIntervalType,
  formatMuscleGroup,
  formatSeconds,
  formatTotalWorkoutDuration,
  getTotalWorkoutDuration,
  toReadableLabel,
} from './workout-format';

const workout: GenerateWorkoutResponse = {
  muscle_group: 'full_body',
  difficulty: 'intermediate',
  equipment: ['bodyweight'],
  blocks: [
    { song: { title: 'One', artist: 'Artist', duration_ms: 65_000 }, duration_seconds: 65, intervals: [] },
    { song: { title: 'Two', artist: 'Artist', duration_ms: 125_000 }, duration_seconds: 125, intervals: [] },
  ],
};

describe('workout formatting', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [65, '1:05'],
    [3605, '60:05'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatSeconds(seconds)).toBe(expected);
  });

  it('totals and formats all workout blocks', () => {
    expect(getTotalWorkoutDuration(workout)).toBe(190);
    expect(formatTotalWorkoutDuration(workout)).toBe('3:10');
  });

  it('formats readable muscle-group labels', () => {
    expect(formatMuscleGroup('full_body')).toBe('Full Body');
  });

  it('formats known and fallback interval labels', () => {
    expect(formatIntervalType('warmup')).toBe('Warmup');
    expect(formatIntervalType('cool_down')).toBe('Cool Down');
  });

  it('formats other enum-style values', () => {
    expect(toReadableLabel('bodyweight')).toBe('Bodyweight');
  });
});
