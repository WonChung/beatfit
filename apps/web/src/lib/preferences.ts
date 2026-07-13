import type {
  Equipment,
  UserPreferences,
  UserPreferencesUpdate,
} from "@/types/workout";

export const DEFAULT_PREFERENCE_VALUES: UserPreferencesUpdate = {
  default_difficulty: "intermediate",
  available_equipment: ["bodyweight"],
  preferred_goal: "endurance",
  avoided_exercise_ids: [],
  favorite_exercise_ids: [],
  high_impact_allowed: true,
  work_rest_preference: "balanced",
};

export function toPreferencesUpdate(preferences: UserPreferences): UserPreferencesUpdate {
  return {
    default_difficulty: preferences.default_difficulty,
    available_equipment: [...preferences.available_equipment],
    preferred_goal: preferences.preferred_goal,
    avoided_exercise_ids: [...preferences.avoided_exercise_ids],
    favorite_exercise_ids: [...preferences.favorite_exercise_ids],
    high_impact_allowed: preferences.high_impact_allowed,
    work_rest_preference: preferences.work_rest_preference,
  };
}

export function chooseAllowedEquipment(
  current: Equipment,
  available: Equipment[],
): Equipment | null {
  return available.includes(current) ? current : (available[0] ?? null);
}

export function getConflictingExerciseIds(preferences: UserPreferencesUpdate): string[] {
  const favorites = new Set(preferences.favorite_exercise_ids);
  return preferences.avoided_exercise_ids.filter((id) => favorites.has(id));
}
