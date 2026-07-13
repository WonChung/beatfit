export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'full_body';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type Equipment = 'bodyweight' | 'dumbbells' | 'gym';

export type WorkoutGoal = 'strength' | 'pump' | 'endurance' | 'cardio';

export type WorkRestPreference = 'balanced' | 'more_work' | 'more_rest';

export interface UserPreferences {
  default_difficulty: Difficulty;
  available_equipment: Equipment[];
  preferred_goal: WorkoutGoal;
  avoided_exercise_ids: string[];
  favorite_exercise_ids: string[];
  high_impact_allowed: boolean;
  work_rest_preference: WorkRestPreference;
  history_reset_at: string | null;
  created_at: string;
  updated_at: string;
}

export type UserPreferencesUpdate = Pick<
  UserPreferences,
  | 'default_difficulty'
  | 'available_equipment'
  | 'preferred_goal'
  | 'avoided_exercise_ids'
  | 'favorite_exercise_ids'
  | 'high_impact_allowed'
  | 'work_rest_preference'
>;

export interface ExerciseSummary {
  id: string;
  name: string;
  primary_muscle_group: MuscleGroup;
  equipment: Equipment[];
  minimum_difficulty: Difficulty;
  high_impact: boolean;
}

export interface Song {
  title: string;
  artist: string;
  duration_ms: number;
  artwork_url?: string;
  provider_identifier?: ProviderIdentifier;
}

export interface AppleMusicProviderIdentifier {
  provider: 'apple_music';
  catalog_id: string;
  library_id?: string | null;
  storefront: string;
}

export interface SpotifyProviderIdentifier {
  provider: 'spotify';
  catalog_id: string;
}

export type ProviderIdentifier = AppleMusicProviderIdentifier | SpotifyProviderIdentifier;

export interface WorkoutInterval {
  start_seconds: number;
  end_seconds: number;
  type: string;
  exercise: string;
  exercise_id?: string | null;
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
  goal?: WorkoutGoal;
}

export interface PersonalizationExplanation {
  personalized: boolean;
  summary: string;
  feedback_signal: WorkoutFeedback | null;
  history_sessions_considered: number;
  adjustments: string[];
}

export interface GenerateWorkoutResponse {
  workout_id?: string | null;
  muscle_group: MuscleGroup;
  difficulty: Difficulty;
  equipment: Equipment[];
  goal?: WorkoutGoal;
  blocks: WorkoutBlock[];
  personalization?: PersonalizationExplanation;
}

export type WorkoutSessionStatus = 'completed' | 'ended_early';

export type WorkoutFeedback = 'too_easy' | 'about_right' | 'too_hard';

export interface WorkoutSession {
  id: string;
  workout: GenerateWorkoutResponse;
  startTime: string;
  endTime: string;
  plannedDurationSeconds: number;
  actualElapsedDurationSeconds: number;
  totalIntervals: number;
  completedIntervals: number;
  completedWorkIntervals: number;
  completedSongBlocks: number;
  status: WorkoutSessionStatus;
  feedback?: WorkoutFeedback;
  serverSessionId?: string;
  remoteSyncError?: string;
}
