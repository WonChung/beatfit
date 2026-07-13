export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "full_body";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Equipment = "bodyweight" | "dumbbells" | "gym";

export interface Song {
  title: string;
  artist: string;
  duration_ms: number;
  artwork_url?: string;
  provider_identifier?: ProviderIdentifier;
}

export interface ProviderIdentifier {
  provider: "apple_music";
  catalog_id: string;
  library_id?: string;
  storefront: string;
}

export interface WorkoutInterval {
  start_seconds: number;
  end_seconds: number;
  type: string;
  exercise: string;
}

export interface WorkoutBlock {
  song: Song;
  duration_seconds: number;
  intervals: WorkoutInterval[];
}

export interface GenerateWorkoutRequest {
  muscle_group: MuscleGroup;
  difficulty: Difficulty;
  equipment: Equipment[];
  songs: Song[];
}

export interface GenerateWorkoutResponse {
  muscle_group: MuscleGroup;
  difficulty: Difficulty;
  equipment: Equipment[];
  blocks: WorkoutBlock[];
}
