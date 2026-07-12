import type { GenerateWorkoutResponse, WorkoutInterval } from "@/types/workout";

export interface TimelineItem {
  blockIndex: number;
  interval: WorkoutInterval;
  songTitle: string;
  artist: string;
  durationMs: number;
}

export type TimerStatus = "ready" | "running" | "paused" | "completed";

export interface TimerState {
  status: TimerStatus;
  currentIndex: number;
  startedAtMs: number | null;
  remainingAtReferenceMs: number;
  completedIndices: number[];
}

export function buildTimeline(workout: GenerateWorkoutResponse): TimelineItem[] {
  return workout.blocks.flatMap((block, blockIndex) =>
    block.intervals
      .map((interval) => ({
        blockIndex,
        interval,
        songTitle: block.song.title,
        artist: block.song.artist,
        durationMs: Math.max(0, (interval.end_seconds - interval.start_seconds) * 1000),
      }))
      .filter((item) => item.durationMs > 0),
  );
}

export function createTimerState(timeline: TimelineItem[]): TimerState {
  if (timeline.length === 0) return completedState(0, []);
  return {
    status: "ready",
    currentIndex: 0,
    startedAtMs: null,
    remainingAtReferenceMs: timeline[0].durationMs,
    completedIndices: [],
  };
}

export function startTimer(state: TimerState, nowMs: number): TimerState {
  return state.status === "ready"
    ? { ...state, status: "running", startedAtMs: nowMs }
    : state;
}

export function pauseTimer(
  state: TimerState,
  timeline: TimelineItem[],
  nowMs: number,
): TimerState {
  const current = reconcileTimer(state, timeline, nowMs);
  if (current.status !== "running") return current;
  return {
    ...current,
    status: "paused",
    startedAtMs: null,
    remainingAtReferenceMs: getRemainingMs(current, nowMs),
  };
}

export function resumeTimer(state: TimerState, nowMs: number): TimerState {
  return state.status === "paused"
    ? { ...state, status: "running", startedAtMs: nowMs }
    : state;
}

export function skipInterval(
  state: TimerState,
  timeline: TimelineItem[],
  nowMs: number,
): TimerState {
  const current = reconcileTimer(state, timeline, nowMs);
  if (current.status === "completed") return current;
  const nextIndex = current.currentIndex + 1;
  if (!timeline[nextIndex]) return completedState(timeline.length, current.completedIndices);
  return {
    ...current,
    currentIndex: nextIndex,
    startedAtMs: current.status === "running" ? nowMs : null,
    remainingAtReferenceMs: timeline[nextIndex].durationMs,
  };
}

export function reconcileTimer(
  state: TimerState,
  timeline: TimelineItem[],
  nowMs: number,
): TimerState {
  if (state.status !== "running" || state.startedAtMs === null) return state;
  if (!timeline[state.currentIndex]) {
    return completedState(timeline.length, state.completedIndices);
  }

  let overflow = Math.max(0, nowMs - state.startedAtMs);
  if (overflow < state.remainingAtReferenceMs) return state;
  overflow -= state.remainingAtReferenceMs;
  let nextIndex = state.currentIndex + 1;
  let completedIndices = addCompleted(state.completedIndices, state.currentIndex);

  while (nextIndex < timeline.length && overflow >= timeline[nextIndex].durationMs) {
    overflow -= timeline[nextIndex].durationMs;
    completedIndices = addCompleted(completedIndices, nextIndex);
    nextIndex += 1;
  }
  if (nextIndex >= timeline.length) return completedState(timeline.length, completedIndices);
  return {
    status: "running",
    currentIndex: nextIndex,
    startedAtMs: nowMs - overflow,
    remainingAtReferenceMs: timeline[nextIndex].durationMs,
    completedIndices,
  };
}

export function getRemainingMs(state: TimerState, nowMs: number): number {
  if (state.status === "completed") return 0;
  const elapsed =
    state.status === "running" && state.startedAtMs !== null
      ? Math.max(0, nowMs - state.startedAtMs)
      : 0;
  return Math.max(0, state.remainingAtReferenceMs - elapsed);
}

export function getTimelineProgress(
  state: TimerState,
  timeline: TimelineItem[],
  nowMs: number,
): number {
  const total = timeline.reduce((sum, item) => sum + item.durationMs, 0);
  if (total <= 0) return state.status === "completed" ? 1 : 0;
  if (state.status === "completed") return 1;
  const before = timeline
    .slice(0, state.currentIndex)
    .reduce((sum, item) => sum + item.durationMs, 0);
  const current = timeline[state.currentIndex]?.durationMs ?? 0;
  return Math.min(1, (before + current - getRemainingMs(state, nowMs)) / total);
}

function completedState(currentIndex: number, completedIndices: number[]): TimerState {
  return {
    status: "completed",
    currentIndex,
    startedAtMs: null,
    remainingAtReferenceMs: 0,
    completedIndices,
  };
}

function addCompleted(indices: number[], index: number): number[] {
  return indices.includes(index) ? indices : [...indices, index];
}
