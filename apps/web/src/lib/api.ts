import type {
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
} from "@/types/workout";

const LOCAL_API_BASE_URL = "http://127.0.0.1:8000";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || LOCAL_API_BASE_URL
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function generateWorkout(
  request: GenerateWorkoutRequest,
  fetcher: typeof fetch = fetch,
): Promise<GenerateWorkoutResponse> {
  let response: Response;
  try {
    response = await fetcher(`${API_BASE_URL}/workouts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new ApiError("Could not reach the BeatFit API. Check that the backend is running.");
  }

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }

  return (await response.json()) as GenerateWorkoutResponse;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // Fall back to a status-based error for non-JSON responses.
  }
  return `The BeatFit API returned an error (${response.status}).`;
}
