import { describe, expect, it } from "vitest";
import {
  chooseAllowedEquipment,
  getConflictingExerciseIds,
  toPreferencesUpdate,
} from "./preferences";
import type { UserPreferences } from "@/types/workout";

const stored: UserPreferences = {
  default_difficulty: "advanced",
  available_equipment: ["dumbbells"],
  preferred_goal: "strength",
  avoided_exercise_ids: ["jump-squat", "burpee"],
  favorite_exercise_ids: ["row", "burpee"],
  high_impact_allowed: false,
  work_rest_preference: "more_rest",
  history_reset_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

describe("preference mapping", () => {
  it("maps only writable preference fields", () => {
    expect(toPreferencesUpdate(stored)).toEqual({
      default_difficulty: "advanced",
      available_equipment: ["dumbbells"],
      preferred_goal: "strength",
      avoided_exercise_ids: ["jump-squat", "burpee"],
      favorite_exercise_ids: ["row", "burpee"],
      high_impact_allowed: false,
      work_rest_preference: "more_rest",
    });
  });

  it("keeps an allowed setup choice and otherwise uses the first available choice", () => {
    expect(chooseAllowedEquipment("dumbbells", ["bodyweight", "dumbbells"])).toBe("dumbbells");
    expect(chooseAllowedEquipment("gym", ["bodyweight", "dumbbells"])).toBe("bodyweight");
    expect(chooseAllowedEquipment("gym", [])).toBeNull();
  });

  it("reports favorites that are also explicitly avoided", () => {
    expect(getConflictingExerciseIds(toPreferencesUpdate(stored))).toEqual(["burpee"]);
  });
});
