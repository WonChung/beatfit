import { describe, expect, it } from "vitest";
import type { GenerateWorkoutResponse } from "@/types/workout";
import { calculateCompletionPercentage, createWorkoutSummary } from "./completion";

const workout: GenerateWorkoutResponse = {
  muscle_group: "legs",
  difficulty: "beginner",
  equipment: ["bodyweight"],
  blocks: [{
    song: { title: "Song", artist: "Artist", duration_ms: 20_000 },
    duration_seconds: 20,
    intervals: [
      { start_seconds: 0, end_seconds: 10, type: "work", exercise: "Squat" },
      { start_seconds: 10, end_seconds: 20, type: "rest", exercise: "Rest" },
    ],
  }],
};

describe("completion summary", () => {
  it("calculates completed and ended-early summaries", () => {
    expect(createWorkoutSummary(workout, "completed", 20, 2).completionPercentage).toBe(100);
    expect(createWorkoutSummary(workout, "ended_early", 5, 0).completionPercentage).toBe(0);
  });

  it("handles empty totals", () => {
    expect(calculateCompletionPercentage(0, 0)).toBe(0);
  });
});
