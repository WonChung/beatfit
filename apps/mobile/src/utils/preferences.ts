import type {
  Difficulty,
  Equipment,
  GenerateWorkoutRequest,
  UserPreferences,
  UserPreferencesUpdate,
  WorkoutGoal,
  WorkRestPreference,
} from '@/types/workout';

export const DEFAULT_PREFERENCES_UPDATE: UserPreferencesUpdate = {
  default_difficulty: 'intermediate',
  available_equipment: ['bodyweight'],
  preferred_goal: 'endurance',
  avoided_exercise_ids: [],
  favorite_exercise_ids: [],
  high_impact_allowed: true,
  work_rest_preference: 'balanced',
};

export interface SetupDefaults {
  difficulty: Difficulty;
  equipment: Equipment[];
  goal: WorkoutGoal;
}

export function preferencesToSetupDefaults(
  preferences: UserPreferences | null,
  previousRequest: GenerateWorkoutRequest | null
): SetupDefaults {
  if (previousRequest) {
    const permittedEquipment = preferences
      ? previousRequest.equipment.filter((item) => preferences.available_equipment.includes(item))
      : previousRequest.equipment;
    return {
      difficulty: previousRequest.difficulty,
      equipment:
        permittedEquipment.length > 0
          ? permittedEquipment
          : preferences?.available_equipment ?? previousRequest.equipment,
      goal: previousRequest.goal ?? preferences?.preferred_goal ?? 'endurance',
    };
  }

  return {
    difficulty: preferences?.default_difficulty ?? DEFAULT_PREFERENCES_UPDATE.default_difficulty,
    equipment:
      preferences?.available_equipment.length
        ? preferences.available_equipment
        : DEFAULT_PREFERENCES_UPDATE.available_equipment,
    goal: preferences?.preferred_goal ?? DEFAULT_PREFERENCES_UPDATE.preferred_goal,
  };
}

export function toPreferencesUpdate(preferences: UserPreferences): UserPreferencesUpdate {
  return {
    default_difficulty: preferences.default_difficulty,
    available_equipment: preferences.available_equipment,
    preferred_goal: preferences.preferred_goal,
    avoided_exercise_ids: preferences.avoided_exercise_ids,
    favorite_exercise_ids: preferences.favorite_exercise_ids,
    high_impact_allowed: preferences.high_impact_allowed,
    work_rest_preference: preferences.work_rest_preference,
  };
}

export function toggleEquipment(
  equipment: Equipment[],
  value: Equipment
): Equipment[] {
  if (equipment.includes(value)) {
    return equipment.length === 1 ? equipment : equipment.filter((item) => item !== value);
  }
  return [...equipment, value];
}

export function toggleExclusiveExercise(
  current: UserPreferencesUpdate,
  exerciseId: string,
  target: 'avoid' | 'favorite'
): UserPreferencesUpdate {
  const targetKey = target === 'avoid' ? 'avoided_exercise_ids' : 'favorite_exercise_ids';
  const otherKey = target === 'avoid' ? 'favorite_exercise_ids' : 'avoided_exercise_ids';
  const targetValues = current[targetKey];

  return {
    ...current,
    [targetKey]: targetValues.includes(exerciseId)
      ? targetValues.filter((id) => id !== exerciseId)
      : [...targetValues, exerciseId],
    [otherKey]: current[otherKey].filter((id) => id !== exerciseId),
  };
}

export const WORK_REST_OPTIONS: readonly {
  label: string;
  value: WorkRestPreference;
}[] = [
  { label: 'Balanced', value: 'balanced' },
  { label: 'More work', value: 'more_work' },
  { label: 'More rest', value: 'more_rest' },
];
