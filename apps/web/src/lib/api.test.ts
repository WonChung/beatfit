import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createWorkoutSession,
  generatePersonalizedWorkout,
  generateWorkout,
  getUserPreferences,
  resetPersonalization,
  updateWorkoutSessionFeedback,
  updateUserPreferences,
} from "./api";
import type { GenerateWorkoutRequest } from "@/types/workout";

const request: GenerateWorkoutRequest = {
  muscle_group: "chest",
  difficulty: "intermediate",
  equipment: ["bodyweight"],
  songs: [{ title: "Song", artist: "Artist", duration_ms: 30_000 }],
  goal: "endurance",
};

describe("generateWorkout", () => {
  it("surfaces backend API errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid workout" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(generateWorkout(request, fetcher)).rejects.toMatchObject({
      name: "ApiError",
      message: "Invalid workout",
      status: 422,
    });
  });

  it("normalizes connection failures", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(generateWorkout(request, fetcher)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("authenticated personalization API", () => {
  it("uses the bearer token and personalized generation endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    await generatePersonalizedWorkout(request, "access-token", fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/\/workouts\/generate\/personalized$/),
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token");
    expect(JSON.parse(String(init.body))).toMatchObject({ goal: "endurance" });
  });

  it("loads and updates the authenticated user's preferences", async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ default_difficulty: "beginner" }));
    await getUserPreferences("access-token", fetcher);
    await updateUserPreferences({
      default_difficulty: "advanced",
      available_equipment: ["dumbbells"],
      preferred_goal: "strength",
      avoided_exercise_ids: ["burpee"],
      favorite_exercise_ids: [],
      high_impact_allowed: false,
      work_rest_preference: "more_rest",
    }, "access-token", fetcher);

    expect(fetcher.mock.calls[0][0]).toMatch(/\/user-preferences$/);
    expect(fetcher.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "PUT" }));
  });

  it("calls the reset endpoint and surfaces authorization errors", async () => {
    const okFetcher = vi.fn().mockResolvedValue(Response.json({ history_reset_at: "2026-01-01" }));
    await resetPersonalization("access-token", okFetcher);
    expect(okFetcher.mock.calls[0][0]).toMatch(/\/user-preferences\/reset$/);

    const deniedFetcher = vi.fn().mockResolvedValue(
      Response.json({ detail: "Authentication required" }, { status: 401 }),
    );
    await expect(getUserPreferences("access-token", deniedFetcher)).rejects.toMatchObject({
      status: 401,
      message: "Authentication required",
    });
  });

  it("rejects a missing access token before making a request", async () => {
    const fetcher = vi.fn();
    await expect(getUserPreferences("", fetcher)).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("persists a completed session with authenticated timer counts", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "session-id" }));
    const session = {
      workout_id: "11111111-1111-4111-8111-111111111111",
      started_at: "2026-01-01T00:00:00.000Z",
      ended_at: "2026-01-01T00:01:00.000Z",
      actual_elapsed_seconds: 60,
      completed_intervals: 4,
      completed_work_intervals: 2,
      completed_song_blocks: 1,
      status: "completed" as const,
    };
    await createWorkoutSession(session, "access-token", fetcher);

    expect(fetcher.mock.calls[0][0]).toMatch(/\/workout-sessions$/);
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(session);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("patches feedback on the persisted server session", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "session-id" }));
    await updateWorkoutSessionFeedback("session/id", "too_hard", "access-token", fetcher);

    expect(fetcher.mock.calls[0][0]).toMatch(/\/workout-sessions\/session%2Fid$/);
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ feedback: { rating: "too_hard" } });
  });
});
