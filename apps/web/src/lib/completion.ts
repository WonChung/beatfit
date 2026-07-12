import type { GenerateWorkoutResponse } from "@/types/workout";
import { getPlannedDurationSeconds } from "./format";

export interface WorkoutSummary {
  status: "completed" | "ended_early";
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  completedIntervals: number;
  totalIntervals: number;
  completionPercentage: number;
}

export function calculateCompletionPercentage(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (completed / total) * 100));
}

export function createWorkoutSummary(
  workout: GenerateWorkoutResponse,
  status: WorkoutSummary["status"],
  actualDurationSeconds: number,
  completedIntervals: number,
): WorkoutSummary {
  const totalIntervals = workout.blocks.reduce(
    (total, block) => total + block.intervals.length,
    0,
  );
  const safeCompleted = Math.min(totalIntervals, Math.max(0, completedIntervals));
  return {
    status,
    plannedDurationSeconds: getPlannedDurationSeconds(workout),
    actualDurationSeconds: Math.max(0, actualDurationSeconds),
    completedIntervals: safeCompleted,
    totalIntervals,
    completionPercentage: calculateCompletionPercentage(safeCompleted, totalIntervals),
  };
}
