import type { GenerateWorkoutResponse, MuscleGroup } from '@/types/workout';

const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  full_body: 'Full Body',
};

const INTERVAL_LABELS: Record<string, string> = {
  warmup: 'Warmup',
  work: 'Work',
  rest: 'Rest',
  burnout: 'Burnout',
};

export function formatSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function getTotalWorkoutDuration(workout: GenerateWorkoutResponse): number {
  return workout.blocks.reduce((total, block) => total + Math.max(0, block.duration_seconds), 0);
}

export function formatTotalWorkoutDuration(workout: GenerateWorkoutResponse): string {
  return formatSeconds(getTotalWorkoutDuration(workout));
}

export function formatMuscleGroup(muscleGroup: MuscleGroup): string {
  return MUSCLE_GROUP_LABELS[muscleGroup];
}

export function formatIntervalType(type: string): string {
  const normalized = type.trim().toLowerCase();
  return INTERVAL_LABELS[normalized] ?? toReadableLabel(normalized);
}

export function toReadableLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
