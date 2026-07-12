import { buildWorkoutTimeline, getTotalTimelineDurationMs } from '@/timer/workout-timer';
import type {
  GenerateWorkoutResponse,
  WorkoutSession,
  WorkoutSessionStatus,
} from '@/types/workout';

let sessionSequence = 0;

interface CreateWorkoutSessionOptions {
  workout: GenerateWorkoutResponse;
  startTimeMs: number;
  endTimeMs: number;
  completedIndices: number[];
  status: WorkoutSessionStatus;
  id?: string;
}

export function createWorkoutSession({
  workout,
  startTimeMs,
  endTimeMs,
  completedIndices,
  status,
  id,
}: CreateWorkoutSessionOptions): WorkoutSession {
  const timeline = buildWorkoutTimeline(workout);
  const completed = getCompletedIntervals(workout, completedIndices);
  const safeStartTime = Math.max(0, startTimeMs);
  const safeEndTime = Math.max(safeStartTime, endTimeMs);

  return {
    id: id ?? createSessionId(safeStartTime),
    workout,
    startTime: new Date(safeStartTime).toISOString(),
    endTime: new Date(safeEndTime).toISOString(),
    plannedDurationSeconds: getTotalTimelineDurationMs(timeline) / 1000,
    actualElapsedDurationSeconds: (safeEndTime - safeStartTime) / 1000,
    totalIntervals: timeline.length,
    completedIntervals: completed.length,
    completedWorkIntervals: completed.filter(
      (item) => item.interval.type.trim().toLowerCase() === 'work'
    ).length,
    completedSongBlocks: getCompletedBlocks(workout, completedIndices),
    status,
  };
}

export function calculateCompletionPercentage(
  completedIntervals: number,
  totalIntervals: number
): number {
  if (totalIntervals <= 0) return 0;
  return Math.min(100, Math.max(0, (completedIntervals / totalIntervals) * 100));
}

export function getCompletedIntervals(
  workout: GenerateWorkoutResponse,
  completedIndices: number[]
) {
  const timeline = buildWorkoutTimeline(workout);
  const uniqueIndices = new Set(completedIndices);
  return timeline.filter((_, index) => uniqueIndices.has(index));
}

export function getCompletedBlocks(
  workout: GenerateWorkoutResponse,
  completedIndices: number[]
): number {
  const timeline = buildWorkoutTimeline(workout);
  const uniqueIndices = new Set(completedIndices);

  return workout.blocks.reduce((completedBlocks, _, blockIndex) => {
    const blockTimelineIndices = timeline
      .map((item, timelineIndex) => ({ item, timelineIndex }))
      .filter(({ item }) => item.blockIndex === blockIndex)
      .map(({ timelineIndex }) => timelineIndex);
    const blockCompleted =
      blockTimelineIndices.length > 0 &&
      blockTimelineIndices.every((timelineIndex) => uniqueIndices.has(timelineIndex));
    return completedBlocks + (blockCompleted ? 1 : 0);
  }, 0);
}

export function getPlannedVsActualDuration(session: WorkoutSession) {
  const differenceSeconds =
    session.actualElapsedDurationSeconds - session.plannedDurationSeconds;
  const actualToPlannedPercentage =
    session.plannedDurationSeconds > 0
      ? (session.actualElapsedDurationSeconds / session.plannedDurationSeconds) * 100
      : 0;

  return { differenceSeconds, actualToPlannedPercentage };
}

function createSessionId(startTimeMs: number): string {
  sessionSequence += 1;
  return `session-${startTimeMs}-${sessionSequence}`;
}
