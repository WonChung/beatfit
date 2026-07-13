import { describe, expect, it } from '@jest/globals';

import type { UserPreferences } from '@/types/workout';

import {
  DEFAULT_PREFERENCES_UPDATE,
  preferencesToSetupDefaults,
  toggleEquipment,
  toggleExclusiveExercise,
} from './preferences';

const preferences: UserPreferences = {
  ...DEFAULT_PREFERENCES_UPDATE,
  default_difficulty: 'advanced',
  available_equipment: ['bodyweight', 'dumbbells'],
  preferred_goal: 'strength',
  history_reset_at: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

describe('mobile preference mapping', () => {
  it('maps saved preferences into a new setup', () => {
    expect(preferencesToSetupDefaults(preferences, null)).toEqual({
      difficulty: 'advanced',
      equipment: ['bodyweight', 'dumbbells'],
      goal: 'strength',
    });
  });

  it('preserves an explicit previous setup', () => {
    expect(
      preferencesToSetupDefaults(preferences, {
        muscle_group: 'core',
        difficulty: 'beginner',
        equipment: ['bodyweight'],
        goal: 'cardio',
        songs: [{ title: 'Song', artist: 'Artist', duration_ms: 60_000 }],
      })
    ).toEqual({ difficulty: 'beginner', equipment: ['bodyweight'], goal: 'cardio' });
  });

  it('removes equipment that is no longer available', () => {
    expect(
      preferencesToSetupDefaults(preferences, {
        muscle_group: 'core',
        difficulty: 'intermediate',
        equipment: ['gym'],
        goal: 'endurance',
        songs: [{ title: 'Song', artist: 'Artist', duration_ms: 60_000 }],
      }).equipment
    ).toEqual(['bodyweight', 'dumbbells']);
  });

  it('never removes the last equipment option', () => {
    expect(toggleEquipment(['bodyweight'], 'bodyweight')).toEqual(['bodyweight']);
  });

  it('resolves conflicting exercise preferences in favor of the latest selection', () => {
    const favorited = toggleExclusiveExercise(DEFAULT_PREFERENCES_UPDATE, 'push-up', 'favorite');
    const avoided = toggleExclusiveExercise(favorited, 'push-up', 'avoid');

    expect(avoided.favorite_exercise_ids).toEqual([]);
    expect(avoided.avoided_exercise_ids).toEqual(['push-up']);
  });
});
