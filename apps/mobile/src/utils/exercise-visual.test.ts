import { describe, expect, it } from '@jest/globals';

import type { ExerciseVisualAssetKey } from './exercise-visual';
import { normalizeExerciseName, resolveExerciseVisual } from './exercise-visual';

const requestedExercises: [string, ExerciseVisualAssetKey][] = [
  ['Scapular Push-Ups', 'push-up'],
  ['Push-Ups', 'push-up'],
  ['Diamond Push-Ups', 'push-up'],
  ['Push-Up Hold', 'push-up'],
  ['Superman Hold', 'prone'],
  ['Reverse Snow Angels', 'prone'],
  ['Dumbbell Rows', 'row'],
  ['Bent-Over Rows', 'row'],
  ['Bodyweight Squats', 'squat'],
  ['Reverse Lunges', 'squat'],
  ['Wall Sit', 'wall-sit'],
  ['Jump Squats', 'squat'],
  ['Arm Circles', 'standing'],
  ['Pike Push-Ups', 'plank'],
  ['Lateral Raises', 'standing'],
  ['Shoulder Taps', 'plank'],
  ['Triceps Dips', 'dip'],
  ['Close-Grip Push-Ups', 'push-up'],
  ['Bicep Curls', 'standing'],
  ['Dead Bug', 'core-floor'],
  ['Plank', 'plank'],
  ['Bicycle Crunch', 'core-floor'],
  ['Hollow Hold', 'core-floor'],
  ['Squats', 'squat'],
  ['Mountain Climbers', 'plank'],
];

const namingVariations: [string, ExerciseVisualAssetKey][] = [
  [' PUSH_UPS ', 'push-up'],
  ['push up', 'push-up'],
  ['push–ups', 'push-up'],
  ['Reverse snow angel', 'prone'],
  ['Dumbbell row', 'row'],
  ['Bodyweight squat', 'squat'],
  ['Shoulder tap', 'plank'],
  ['Bench triceps dip', 'dip'],
  ['Forearm plank', 'plank'],
];

describe('exercise visual mapping', () => {
  it.each(requestedExercises)('resolves %s to %s', (exerciseName, expectedAssetKey) => {
    expect(resolveExerciseVisual(exerciseName)).toEqual({
      assetKey: expectedAssetKey,
      isFallback: false,
    });
  });

  it.each(namingVariations)('handles the naming variation %s', (exerciseName, expectedAssetKey) => {
    expect(resolveExerciseVisual(exerciseName).assetKey).toBe(expectedAssetKey);
  });

  it('uses the fallback for unknown and blank exercise names', () => {
    expect(resolveExerciseVisual('Dragon flag')).toEqual({
      assetKey: 'fallback',
      isFallback: true,
    });
    expect(resolveExerciseVisual('   ')).toEqual({
      assetKey: 'fallback',
      isFallback: true,
    });
  });

  it('normalizes punctuation, case, underscores, and repeated whitespace', () => {
    expect(normalizeExerciseName('  CLOSE_GRIP—Push-Ups  ')).toBe('close grip push ups');
  });
});
