import type { GenerateWorkoutResponse, Song, WorkoutInterval } from '@/types/workout';

export interface TimelineInterval {
  blockIndex: number;
  intervalIndex: number;
  song: Song;
  interval: WorkoutInterval;
  durationMs: number;
}

export type WorkoutTimerStatus = 'ready' | 'running' | 'paused' | 'completed';

export interface WorkoutTimerState {
  status: WorkoutTimerStatus;
  currentIndex: number;
  intervalStartedAtMs: number | null;
  remainingAtReferenceMs: number;
  completedIndices: number[];
}

export function buildWorkoutTimeline(workout: GenerateWorkoutResponse | null): TimelineInterval[] {
  if (!workout) return [];

  return workout.blocks.flatMap((block, blockIndex) =>
    block.intervals
      .map((interval, intervalIndex) => ({
        blockIndex,
        intervalIndex,
        song: block.song,
        interval,
        durationMs: Math.max(0, (interval.end_seconds - interval.start_seconds) * 1000),
      }))
      .filter((item) => item.durationMs > 0)
  );
}

export function createWorkoutTimerState(timeline: TimelineInterval[]): WorkoutTimerState {
  if (timeline.length === 0) return completedState(0, []);

  return {
    status: 'ready',
    currentIndex: 0,
    intervalStartedAtMs: null,
    remainingAtReferenceMs: timeline[0].durationMs,
    completedIndices: [],
  };
}

export function startWorkoutTimer(
  state: WorkoutTimerState,
  nowMs: number
): WorkoutTimerState {
  if (state.status !== 'ready') return state;
  return { ...state, status: 'running', intervalStartedAtMs: nowMs };
}

export function pauseWorkoutTimer(
  state: WorkoutTimerState,
  timeline: TimelineInterval[],
  nowMs: number
): WorkoutTimerState {
  const current = reconcileWorkoutTimer(state, timeline, nowMs);
  if (current.status !== 'running') return current;

  return {
    ...current,
    status: 'paused',
    intervalStartedAtMs: null,
    remainingAtReferenceMs: getRemainingTimeMs(current, nowMs),
  };
}

export function resumeWorkoutTimer(
  state: WorkoutTimerState,
  nowMs: number
): WorkoutTimerState {
  if (state.status !== 'paused') return state;
  return { ...state, status: 'running', intervalStartedAtMs: nowMs };
}

export function skipWorkoutInterval(
  state: WorkoutTimerState,
  timeline: TimelineInterval[],
  nowMs: number
): WorkoutTimerState {
  const current = reconcileWorkoutTimer(state, timeline, nowMs);
  if (current.status === 'completed') return current;
  return moveToInterval(current, timeline, current.currentIndex + 1, nowMs);
}

export function previousWorkoutInterval(
  state: WorkoutTimerState,
  timeline: TimelineInterval[],
  nowMs: number
): WorkoutTimerState {
  const current = reconcileWorkoutTimer(state, timeline, nowMs);
  if (current.status === 'completed' || current.currentIndex === 0) return current;
  return moveToInterval(current, timeline, current.currentIndex - 1, nowMs);
}

export function reconcileWorkoutTimer(
  state: WorkoutTimerState,
  timeline: TimelineInterval[],
  nowMs: number
): WorkoutTimerState {
  if (state.status !== 'running' || state.intervalStartedAtMs === null) return state;
  if (!timeline[state.currentIndex]) {
    return completedState(timeline.length, state.completedIndices);
  }

  let overflowMs = Math.max(0, nowMs - state.intervalStartedAtMs);
  if (overflowMs < state.remainingAtReferenceMs) return state;

  overflowMs -= state.remainingAtReferenceMs;
  let nextIndex = state.currentIndex + 1;
  let completedIndices = addCompletedIndex(state.completedIndices, state.currentIndex);

  while (nextIndex < timeline.length && overflowMs >= timeline[nextIndex].durationMs) {
    overflowMs -= timeline[nextIndex].durationMs;
    completedIndices = addCompletedIndex(completedIndices, nextIndex);
    nextIndex += 1;
  }

  if (nextIndex >= timeline.length) return completedState(timeline.length, completedIndices);

  return {
    status: 'running',
    currentIndex: nextIndex,
    intervalStartedAtMs: nowMs - overflowMs,
    remainingAtReferenceMs: timeline[nextIndex].durationMs,
    completedIndices,
  };
}

export function getRemainingTimeMs(state: WorkoutTimerState, nowMs: number): number {
  if (state.status === 'completed') return 0;
  const elapsedSinceReference =
    state.status === 'running' && state.intervalStartedAtMs !== null
      ? Math.max(0, nowMs - state.intervalStartedAtMs)
      : 0;
  return Math.max(0, state.remainingAtReferenceMs - elapsedSinceReference);
}

export function getElapsedWorkoutTimeMs(
  state: WorkoutTimerState,
  timeline: TimelineInterval[],
  nowMs: number
): number {
  const totalDuration = getTotalTimelineDurationMs(timeline);
  if (state.status === 'completed') return totalDuration;

  const completedDuration = timeline
    .slice(0, state.currentIndex)
    .reduce((total, item) => total + item.durationMs, 0);
  const currentDuration = timeline[state.currentIndex]?.durationMs ?? 0;
  const currentElapsed = Math.max(0, currentDuration - getRemainingTimeMs(state, nowMs));
  return Math.min(totalDuration, completedDuration + currentElapsed);
}

export function getWorkoutProgress(
  state: WorkoutTimerState,
  timeline: TimelineInterval[],
  nowMs: number
): number {
  const totalDuration = getTotalTimelineDurationMs(timeline);
  if (totalDuration === 0) return state.status === 'completed' ? 1 : 0;
  return Math.min(1, getElapsedWorkoutTimeMs(state, timeline, nowMs) / totalDuration);
}

export function getTotalTimelineDurationMs(timeline: TimelineInterval[]): number {
  return timeline.reduce((total, item) => total + item.durationMs, 0);
}

function moveToInterval(
  state: WorkoutTimerState,
  timeline: TimelineInterval[],
  targetIndex: number,
  nowMs: number
): WorkoutTimerState {
  if (!timeline[targetIndex]) {
    return completedState(timeline.length, state.completedIndices);
  }

  return {
    status: state.status,
    currentIndex: targetIndex,
    intervalStartedAtMs: state.status === 'running' ? nowMs : null,
    remainingAtReferenceMs: timeline[targetIndex].durationMs,
    completedIndices:
      targetIndex < state.currentIndex
        ? state.completedIndices.filter((index) => index !== targetIndex)
        : state.completedIndices,
  };
}

function completedState(currentIndex: number, completedIndices: number[]): WorkoutTimerState {
  return {
    status: 'completed',
    currentIndex,
    intervalStartedAtMs: null,
    remainingAtReferenceMs: 0,
    completedIndices,
  };
}

function addCompletedIndex(completedIndices: number[], index: number): number[] {
  return completedIndices.includes(index) ? completedIndices : [...completedIndices, index];
}
