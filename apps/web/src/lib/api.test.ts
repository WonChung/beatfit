import { describe, expect, it, vi } from "vitest";
import { ApiError, generateWorkout } from "./api";
import type { GenerateWorkoutRequest } from "@/types/workout";

const request: GenerateWorkoutRequest = {
  muscle_group: "chest",
  difficulty: "intermediate",
  equipment: ["bodyweight"],
  songs: [{ title: "Song", artist: "Artist", duration_ms: 30_000 }],
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
