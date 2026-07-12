import type { GenerateWorkoutResponse, MuscleGroup } from "@/types/workout";

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  full_body: "Full Body",
};

export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function formatMuscleGroup(value: MuscleGroup): string {
  return MUSCLE_LABELS[value];
}

export function readableLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getPlannedDurationSeconds(workout: GenerateWorkoutResponse): number {
  return workout.blocks.reduce((total, block) => total + Math.max(0, block.duration_seconds), 0);
}
