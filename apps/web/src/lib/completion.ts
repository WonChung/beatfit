import type {
  GenerateWorkoutResponse,
  WorkoutSessionCreate,
  WorkoutSessionStatus,
} from "@/types/workout";
import { getPlannedDurationSeconds } from "./format";

export interface WorkoutSummary {
  status: WorkoutSessionStatus;
  startedAt: string;
  endedAt: string;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  completedIntervals: number;
  completedWorkIntervals: number;
  completedSongBlocks: number;
  totalIntervals: number;
  completionPercentage: number;
}

export interface CompletedWorkoutStats {
  completedIntervals: number;
  completedWorkIntervals: number;
  completedSongBlocks: number;
  totalIntervals: number;
}

export function calculateCompletionPercentage(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (completed / total) * 100));
}

export function createWorkoutSummary(
  workout: GenerateWorkoutResponse,
  status: WorkoutSummary["status"],
  startedAtMs: number,
  endedAtMs: number,
  completedIndices: number[],
): WorkoutSummary {
  const safeEndMs = Math.max(startedAtMs, endedAtMs);
  const stats = getCompletedWorkoutStats(workout, completedIndices);
  return {
    status,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(safeEndMs).toISOString(),
    plannedDurationSeconds: getPlannedDurationSeconds(workout),
    actualDurationSeconds: Math.max(0, (safeEndMs - startedAtMs) / 1000),
    ...stats,
    completionPercentage: calculateCompletionPercentage(
      stats.completedIntervals,
      stats.totalIntervals,
    ),
  };
}

export function getCompletedWorkoutStats(
  workout: GenerateWorkoutResponse,
  completedIndices: number[],
): CompletedWorkoutStats {
  const timeline = workout.blocks.flatMap((block, blockIndex) =>
    block.intervals
      .filter((interval) => interval.end_seconds > interval.start_seconds)
      .map((interval) => ({ blockIndex, type: interval.type })),
  );
  const validCompleted = new Set(
    completedIndices.filter((index) => Number.isInteger(index) && index >= 0 && index < timeline.length),
  );
  const completedWorkIntervals = [...validCompleted].filter(
    (index) => timeline[index]?.type === "work",
  ).length;
  const completedSongBlocks = workout.blocks.reduce((total, block, blockIndex) => {
    const blockIndices = timeline.flatMap((item, index) => item.blockIndex === blockIndex ? [index] : []);
    return total + (blockIndices.length > 0 && blockIndices.every((index) => validCompleted.has(index)) ? 1 : 0);
  }, 0);
  return {
    completedIntervals: validCompleted.size,
    completedWorkIntervals,
    completedSongBlocks,
    totalIntervals: timeline.length,
  };
}

export function toWorkoutSessionCreate(
  workoutId: string,
  summary: WorkoutSummary,
): WorkoutSessionCreate {
  return {
    workout_id: workoutId,
    started_at: summary.startedAt,
    ended_at: summary.endedAt,
    actual_elapsed_seconds: Math.max(0, Math.round(summary.actualDurationSeconds)),
    completed_intervals: summary.completedIntervals,
    completed_work_intervals: summary.completedWorkIntervals,
    completed_song_blocks: summary.completedSongBlocks,
    status: summary.status,
  };
}
