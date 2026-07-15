import { describe, expect, it } from '@jest/globals';

import {
  EXERCISE_ANIMATION_REGISTRY,
  getExerciseAnimationPlaybackState,
  resolveExerciseAnimation,
} from './exercise-animation';

const initiallySupportedNames = [
  'Push-Ups',
  'Diamond Push-Ups',
  'Scapular Push-Ups',
  'Push-Up Hold',
  'Bodyweight Squats',
  'Reverse Lunges',
  'Wall Sit',
  'Jump Squats',
  'Plank',
  'Mountain Climbers',
  'Bicycle Crunch',
  'Dead Bug',
  'Hollow Hold',
  'Superman Hold',
  'Reverse Snow Angels',
  'Dumbbell Rows',
  'Bent-Over Rows',
  'Bicep Curls',
  'Lateral Raises',
  'Pike Push-Ups',
  'Shoulder Taps',
  'Triceps Dips',
  'Close-Grip Push-Ups',
] as const;

describe('exercise animation registry', () => {
  it('resolves a known stable exercise ID to the correct animation', () => {
    const resolution = resolveExerciseAnimation({
      exerciseId: 'chest-bodyweight-push-up',
      exerciseName: 'A renamed push-up',
      intervalType: 'work',
    });

    expect(resolution).toMatchObject({
      exerciseId: 'chest-bodyweight-push-up',
      animationKey: 'push-up-cycle',
      startPoseKey: 'push-up-start',
      endPoseKey: 'push-up-end',
      loop: true,
      source: 'exercise-id',
    });
  });

  it('uses the generic animated silhouette for an unknown exercise', () => {
    expect(
      resolveExerciseAnimation({
        exerciseId: 'full-body-dragon-flag',
        exerciseName: 'Dragon Flag',
        intervalType: 'work',
      })
    ).toMatchObject({
      animationKey: 'generic-cycle',
      startPoseKey: 'generic-start',
      endPoseKey: 'generic-end',
      source: 'fallback',
    });
  });

  it('normalizes an older name-only workout interval', () => {
    expect(
      resolveExerciseAnimation({
        exerciseName: '  BODYWEIGHT_squats  ',
        intervalType: 'warmup',
      })
    ).toMatchObject({
      exerciseId: 'legs-bodyweight-bodyweight-squat',
      animationKey: 'squat-cycle',
      source: 'exercise-name',
    });
  });

  it.each(initiallySupportedNames)('registers the requested exercise name %s', (exerciseName) => {
    expect(resolveExerciseAnimation({ exerciseName, intervalType: 'work' }).source).not.toBe(
      'fallback'
    );
  });

  it('changes the render key when the active interval exercise changes', () => {
    const pushUp = resolveExerciseAnimation({
      exerciseId: 'chest-bodyweight-push-up',
      exerciseName: 'Push-Up',
      intervalType: 'work',
    });
    const squat = resolveExerciseAnimation({
      exerciseId: 'legs-bodyweight-bodyweight-squat',
      exerciseName: 'Bodyweight Squat',
      intervalType: 'work',
    });

    expect(pushUp.renderKey).not.toBe(squat.renderKey);
  });

  it('reports paused and resumed playback states', () => {
    const animation = resolveExerciseAnimation({
      exerciseId: 'chest-bodyweight-push-up',
      exerciseName: 'Push-Up',
      intervalType: 'work',
    });

    expect(
      getExerciseAnimationPlaybackState({
        animation,
        isPaused: true,
        reduceMotionEnabled: false,
      })
    ).toBe('paused');
    expect(
      getExerciseAnimationPlaybackState({
        animation,
        isPaused: false,
        reduceMotionEnabled: false,
      })
    ).toBe('animating');
  });

  it('replaces the previous exercise with breathing motion during rest', () => {
    expect(
      resolveExerciseAnimation({
        exerciseId: 'chest-bodyweight-push-up',
        exerciseName: 'Push-Up',
        intervalType: ' REST ',
      })
    ).toMatchObject({
      exerciseId: 'interval-rest',
      animationKey: 'breathing-cycle',
      source: 'rest',
    });
  });

  it('uses a static pose when reduced motion is enabled', () => {
    const animation = resolveExerciseAnimation({
      exerciseId: 'full_body-bodyweight-mountain-climbers',
      exerciseName: 'Mountain Climbers',
      intervalType: 'burnout',
    });

    expect(animation.startPoseKey).toBe('mountain-climber-start');
    expect(
      getExerciseAnimationPlaybackState({
        animation,
        isPaused: false,
        reduceMotionEnabled: true,
      })
    ).toBe('reduced-motion');
  });

  it('supports work, warmup, and burnout playback speeds without changing the asset', () => {
    const work = resolveExerciseAnimation({ exerciseName: 'Push-Ups', intervalType: 'work' });
    const warmup = resolveExerciseAnimation({ exerciseName: 'Push-Ups', intervalType: 'warmup' });
    const burnout = resolveExerciseAnimation({ exerciseName: 'Push-Ups', intervalType: 'burnout' });

    expect(warmup.animationKey).toBe(work.animationKey);
    expect(burnout.animationKey).toBe(work.animationKey);
    expect(warmup.playbackSpeed).toBeLessThan(work.playbackSpeed);
    expect(burnout.playbackSpeed).toBeGreaterThan(work.playbackSpeed);
  });

  it('keeps optional start-only pose definitions for static holds', () => {
    expect(EXERCISE_ANIMATION_REGISTRY['chest-bodyweight-push-up-hold']).toMatchObject({
      startPoseKey: 'push-up-end',
      loop: false,
    });
  });
});
