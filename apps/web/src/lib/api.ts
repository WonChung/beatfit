import type {
  Exercise,
  FeedbackRating,
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
  PersistedWorkoutSession,
  UserPreferences,
  UserPreferencesUpdate,
  WorkoutSessionCreate,
} from "@/types/workout";
import { getApiBaseUrl } from "./api-config";

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
  const url = `${getApiBaseUrl()}/workouts/generate`;
  try {
    response = await fetcher(url, {
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

export async function generatePersonalizedWorkout(
  request: GenerateWorkoutRequest,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<GenerateWorkoutResponse> {
  return requestJson<GenerateWorkoutResponse>(
    "/workouts/generate/personalized",
    { method: "POST", body: JSON.stringify(request) },
    accessToken,
    fetcher,
  );
}

export async function getUserPreferences(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<UserPreferences> {
  return requestJson<UserPreferences>("/user-preferences", {}, accessToken, fetcher);
}

export async function updateUserPreferences(
  preferences: UserPreferencesUpdate,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<UserPreferences> {
  return requestJson<UserPreferences>(
    "/user-preferences",
    { method: "PUT", body: JSON.stringify(preferences) },
    accessToken,
    fetcher,
  );
}

export async function resetPersonalization(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<UserPreferences> {
  return requestJson<UserPreferences>(
    "/user-preferences/reset",
    { method: "POST" },
    accessToken,
    fetcher,
  );
}

export async function listExercises(
  fetcher: typeof fetch = fetch,
): Promise<Exercise[]> {
  return requestJson<Exercise[]>("/exercises", {}, undefined, fetcher);
}

export async function createWorkoutSession(
  session: WorkoutSessionCreate,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<PersistedWorkoutSession> {
  return requestJson<PersistedWorkoutSession>(
    "/workout-sessions",
    { method: "POST", body: JSON.stringify(session) },
    accessToken,
    fetcher,
  );
}

export async function updateWorkoutSessionFeedback(
  sessionId: string,
  rating: FeedbackRating,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<PersistedWorkoutSession> {
  return requestJson<PersistedWorkoutSession>(
    `/workout-sessions/${encodeURIComponent(sessionId)}`,
    { method: "PATCH", body: JSON.stringify({ feedback: { rating } }) },
    accessToken,
    fetcher,
  );
}

async function requestJson<ResponseBody>(
  path: string,
  init: RequestInit,
  accessToken: string | undefined,
  fetcher: typeof fetch,
): Promise<ResponseBody> {
  if (accessToken !== undefined && !accessToken.trim()) {
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }

  let response: Response;
  const url = `${getApiBaseUrl()}${path}`;
  try {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    response = await fetcher(url, { ...init, headers });
  } catch {
    throw new ApiError("Could not reach the BeatFit API. Check that the backend is running.");
  }

  if (!response.ok) throw new ApiError(await readError(response), response.status);
  return (await response.json()) as ResponseBody;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const message = body.detail
        .map((item) => typeof item === "object" && item && "msg" in item ? String(item.msg) : "")
        .filter(Boolean)
        .join(" ");
      if (message) return message;
    }
  } catch {
    // Fall back to a status-based error for non-JSON responses.
  }
  return `The BeatFit API returned an error (${response.status}).`;
}
