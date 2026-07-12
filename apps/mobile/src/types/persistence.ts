import type {
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
  WorkoutSession,
} from '@/types/workout';

export interface GeneratedWorkoutRecord {
  id: string;
  request: GenerateWorkoutRequest;
  workout: GenerateWorkoutResponse;
  generatedAt: string;
}

export interface SavedWorkout {
  id: string;
  name: string;
  request: GenerateWorkoutRequest;
  workout: GenerateWorkoutResponse;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
}

export interface BeatFitStorageSchemaV1 {
  version: 1;
  generatedWorkouts: GeneratedWorkoutRecord[];
  savedWorkouts: SavedWorkout[];
  sessions: WorkoutSession[];
}

export type BeatFitStorageSchema = BeatFitStorageSchemaV1;
