import { describe, expect, it } from "vitest";
import type { GenerateWorkoutResponse } from "@/types/workout";
import {
  calculateCompletionPercentage,
  createWorkoutSummary,
  getCompletedWorkoutStats,
  toWorkoutSessionCreate,
} from "./completion";

const workout: GenerateWorkoutResponse = {
  workout_id: "11111111-1111-4111-8111-111111111111",
  muscle_group: "legs",
  difficulty: "beginner",
  equipment: ["bodyweight"],
  goal: "endurance",
  personalization: {
    personalized: false, summary: "No personalization was applied.", feedback_signal: null,
    history_sessions_considered: 0, adjustments: [],
  },
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
    const completed = createWorkoutSummary(workout, "completed", 1_000, 21_000, [0, 1]);
    const early = createWorkoutSummary(workout, "ended_early", 1_000, 6_000, []);
    expect(completed).toMatchObject({
      completionPercentage: 100,
      completedWorkIntervals: 1,
      completedSongBlocks: 1,
      actualDurationSeconds: 20,
    });
    expect(early).toMatchObject({ completionPercentage: 0, completedSongBlocks: 0 });
    expect(completed.startedAt).toBe("1970-01-01T00:00:01.000Z");
    expect(completed.endedAt).toBe("1970-01-01T00:00:21.000Z");
  });

  it("counts only unique valid completed intervals and fully completed blocks", () => {
    expect(getCompletedWorkoutStats(workout, [0, 0, 99, -1])).toEqual({
      completedIntervals: 1,
      completedWorkIntervals: 1,
      completedSongBlocks: 0,
      totalIntervals: 2,
    });
  });

  it("maps the timer summary into the backend session payload", () => {
    const summary = createWorkoutSummary(workout, "ended_early", 1_000, 6_400, [0]);
    expect(toWorkoutSessionCreate(workout.workout_id!, summary)).toEqual({
      workout_id: workout.workout_id,
      started_at: "1970-01-01T00:00:01.000Z",
      ended_at: "1970-01-01T00:00:06.400Z",
      actual_elapsed_seconds: 5,
      completed_intervals: 1,
      completed_work_intervals: 1,
      completed_song_blocks: 0,
      status: "ended_early",
    });
  });

  it("handles empty totals", () => {
    expect(calculateCompletionPercentage(0, 0)).toBe(0);
  });
});
