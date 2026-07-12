import { describe, expect, it } from '@jest/globals';

import type { GenerateWorkoutResponse } from '@/types/workout';

import {
  buildWorkoutTimeline,
  createWorkoutTimerState,
  getRemainingTimeMs,
  pauseWorkoutTimer,
  previousWorkoutInterval,
  reconcileWorkoutTimer,
  resumeWorkoutTimer,
  skipWorkoutInterval,
  startWorkoutTimer,
} from './workout-timer';

function createWorkout(durations: number[][]): GenerateWorkoutResponse {
  return {
    muscle_group: 'core',
    difficulty: 'intermediate',
    equipment: ['bodyweight'],
    blocks: durations.map((blockDurations, blockIndex) => ({
      song: {
        title: `Song ${blockIndex + 1}`,
        artist: 'Artist',
        duration_ms: blockDurations.reduce((total, duration) => total + duration, 0) * 1000,
      },
      duration_seconds: blockDurations.reduce((total, duration) => total + duration, 0),
      intervals: blockDurations.map((duration, intervalIndex) => ({
        start_seconds: blockDurations.slice(0, intervalIndex).reduce((a, b) => a + b, 0),
        end_seconds:
          blockDurations.slice(0, intervalIndex).reduce((a, b) => a + b, 0) + duration,
        type: intervalIndex % 2 === 0 ? 'work' : 'rest',
        exercise: `Exercise ${intervalIndex + 1}`,
      })),
    })),
  };
}

describe('workout timer transitions', () => {
  it('starts at the first interval with its full duration', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[10, 5]]));
    const state = createWorkoutTimerState(timeline);

    expect(state.status).toBe('ready');
    expect(state.currentIndex).toBe(0);
    expect(getRemainingTimeMs(state, 1000)).toBe(10_000);
  });

  it('automatically advances across intervals and song blocks', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[2, 2], [3]]));
    const running = startWorkoutTimer(createWorkoutTimerState(timeline), 1000);
    const advanced = reconcileWorkoutTimer(running, timeline, 5500);

    expect(advanced.currentIndex).toBe(2);
    expect(timeline[advanced.currentIndex].blockIndex).toBe(1);
    expect(getRemainingTimeMs(advanced, 5500)).toBe(2500);
  });

  it('skips to the next interval and restarts it at full duration', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[10, 5]]));
    const running = startWorkoutTimer(createWorkoutTimerState(timeline), 0);
    const skipped = skipWorkoutInterval(running, timeline, 3000);

    expect(skipped.currentIndex).toBe(1);
    expect(getRemainingTimeMs(skipped, 3000)).toBe(5000);
  });

  it('returns to the previous interval at full duration', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[10, 5]]));
    const second = skipWorkoutInterval(
      startWorkoutTimer(createWorkoutTimerState(timeline), 0),
      timeline,
      1000
    );
    const previous = previousWorkoutInterval(second, timeline, 2000);

    expect(previous.currentIndex).toBe(0);
    expect(getRemainingTimeMs(previous, 2000)).toBe(10_000);
  });

  it('safely stays on the first interval when previous is requested', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[10]]));
    const state = createWorkoutTimerState(timeline);
    expect(previousWorkoutInterval(state, timeline, 0)).toBe(state);
  });

  it('pauses without consuming paused wall-clock time', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[10]]));
    const running = startWorkoutTimer(createWorkoutTimerState(timeline), 1000);
    const paused = pauseWorkoutTimer(running, timeline, 4000);

    expect(paused.status).toBe('paused');
    expect(getRemainingTimeMs(paused, 20_000)).toBe(7000);
  });

  it('resumes accurately through multiple pause cycles', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[10]]));
    const firstRun = startWorkoutTimer(createWorkoutTimerState(timeline), 0);
    const firstPause = pauseWorkoutTimer(firstRun, timeline, 2000);
    const secondRun = resumeWorkoutTimer(firstPause, 10_000);
    const secondPause = pauseWorkoutTimer(secondRun, timeline, 13_000);
    const thirdRun = resumeWorkoutTimer(secondPause, 20_000);

    expect(getRemainingTimeMs(thirdRun, 21_000)).toBe(4000);
  });

  it('completes after the final interval', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[2]]));
    const running = startWorkoutTimer(createWorkoutTimerState(timeline), 0);
    expect(reconcileWorkoutTimer(running, timeline, 2000).status).toBe('completed');
  });

  it('immediately completes an empty workout', () => {
    const timeline = buildWorkoutTimeline(createWorkout([]));
    expect(timeline).toEqual([]);
    expect(createWorkoutTimerState(timeline).status).toBe('completed');
  });

  it('advances through very short intervals even after a delayed tick', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[0.05, 0.05, 1]]));
    const running = startWorkoutTimer(createWorkoutTimerState(timeline), 0);
    const advanced = reconcileWorkoutTimer(running, timeline, 125);

    expect(advanced.currentIndex).toBe(2);
    expect(getRemainingTimeMs(advanced, 125)).toBe(975);
  });

  it('never returns negative remaining time', () => {
    const timeline = buildWorkoutTimeline(createWorkout([[1]]));
    const running = startWorkoutTimer(createWorkoutTimerState(timeline), 0);
    expect(getRemainingTimeMs(running, 5000)).toBe(0);
  });
});
