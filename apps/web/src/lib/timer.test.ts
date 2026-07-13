import { describe, expect, it } from "vitest";
import type { GenerateWorkoutResponse } from "@/types/workout";
import {
  buildTimeline,
  createTimerState,
  getRemainingMs,
  pauseTimer,
  reconcileTimer,
  resumeTimer,
  skipInterval,
  startTimer,
} from "./timer";

const workout: GenerateWorkoutResponse = {
  workout_id: "11111111-1111-4111-8111-111111111111",
  muscle_group: "core",
  difficulty: "intermediate",
  equipment: ["bodyweight"],
  goal: "endurance",
  personalization: {
    personalized: false, summary: "No personalization was applied.", feedback_signal: null,
    history_sessions_considered: 0, adjustments: [],
  },
  blocks: [{
    song: { title: "Song", artist: "Artist", duration_ms: 5000 },
    duration_seconds: 5,
    intervals: [
      { start_seconds: 0, end_seconds: 2, type: "work", exercise: "Plank" },
      { start_seconds: 2, end_seconds: 5, type: "rest", exercise: "Rest" },
    ],
  }],
};

describe("timer transitions", () => {
  it("automatically advances and completes", () => {
    const timeline = buildTimeline(workout);
    const running = startTimer(createTimerState(timeline), 0);
    expect(reconcileTimer(running, timeline, 2500).currentIndex).toBe(1);
    expect(reconcileTimer(running, timeline, 5000).status).toBe("completed");
  });

  it("skips without counting the skipped interval", () => {
    const timeline = buildTimeline(workout);
    const skipped = skipInterval(startTimer(createTimerState(timeline), 0), timeline, 500);
    expect(skipped.currentIndex).toBe(1);
    expect(skipped.completedIndices).toEqual([]);
  });

  it("pauses and resumes from the correct remaining time", () => {
    const timeline = buildTimeline(workout);
    const running = startTimer(createTimerState(timeline), 1000);
    const paused = pauseTimer(running, timeline, 2000);
    expect(getRemainingMs(paused, 10_000)).toBe(1000);
    const resumed = resumeTimer(paused, 20_000);
    expect(getRemainingMs(resumed, 20_500)).toBe(500);
  });
});
