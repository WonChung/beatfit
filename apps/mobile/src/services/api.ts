import type {
  ExerciseSummary,
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
  UserPreferences,
  UserPreferencesUpdate,
  WorkoutFeedback,
  WorkoutSession,
} from '@/types/workout';

// This fallback works for web and iOS Simulator local development. A physical
// device must use the development Mac's LAN IP in EXPO_PUBLIC_API_BASE_URL.
const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || LOCAL_API_BASE_URL
).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function generateWorkout(
  request: GenerateWorkoutRequest
): Promise<GenerateWorkoutResponse> {
  return apiRequest<GenerateWorkoutResponse>('/workouts/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function generatePersonalizedWorkout(
  request: GenerateWorkoutRequest,
  accessToken: string
): Promise<GenerateWorkoutResponse> {
  return apiRequest<GenerateWorkoutResponse>('/workouts/generate/personalized', {
    method: 'POST',
    body: JSON.stringify(request),
    accessToken,
  });
}

export async function getUserPreferences(accessToken: string): Promise<UserPreferences> {
  return apiRequest<UserPreferences>('/user-preferences', { accessToken });
}

export async function updateUserPreferences(
  preferences: UserPreferencesUpdate,
  accessToken: string
): Promise<UserPreferences> {
  return apiRequest<UserPreferences>('/user-preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
    accessToken,
  });
}

export async function resetPersonalization(accessToken: string): Promise<UserPreferences> {
  return apiRequest<UserPreferences>('/user-preferences/reset', {
    method: 'POST',
    accessToken,
  });
}

export async function getExerciseCatalog(): Promise<ExerciseSummary[]> {
  return apiRequest<ExerciseSummary[]>('/exercises');
}

interface RemoteWorkoutSession {
  id: string;
}

export interface RemoteWorkoutSessionCreate {
  workout_id: string;
  started_at: string;
  ended_at: string;
  actual_elapsed_seconds: number;
  completed_intervals: number;
  completed_work_intervals: number;
  completed_song_blocks: number;
  status: WorkoutSession['status'];
}

export function toRemoteWorkoutSessionCreate(
  workoutId: string,
  session: WorkoutSession
): RemoteWorkoutSessionCreate {
  return {
    workout_id: workoutId,
    started_at: session.startTime,
    ended_at: session.endTime,
    actual_elapsed_seconds: Math.max(0, Math.round(session.actualElapsedDurationSeconds)),
    completed_intervals: Math.max(0, Math.round(session.completedIntervals)),
    completed_work_intervals: Math.max(0, Math.round(session.completedWorkIntervals)),
    completed_song_blocks: Math.max(0, Math.round(session.completedSongBlocks)),
    status: session.status,
  };
}

export async function persistWorkoutSession(
  workoutId: string,
  session: WorkoutSession,
  accessToken: string
): Promise<string> {
  const persisted = await apiRequest<RemoteWorkoutSession>('/workout-sessions', {
    method: 'POST',
    body: JSON.stringify(toRemoteWorkoutSessionCreate(workoutId, session)),
    accessToken,
  });
  return persisted.id;
}

export async function persistWorkoutSessionFeedback(
  serverSessionId: string,
  feedback: WorkoutFeedback,
  accessToken: string
): Promise<void> {
  await apiRequest<RemoteWorkoutSession>(`/workout-sessions/${serverSessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ feedback: { rating: feedback } }),
    accessToken,
  });
}

interface ApiRequestOptions extends RequestInit {
  accessToken?: string;
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response: Response;
  const { accessToken, headers, ...requestOptions } = options;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers: {
        Accept: 'application/json',
        ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError('Could not reach the BeatFit API. Check the API URL and your connection.');
  }

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      const firstMessage = body.detail.find(
        (item): item is { msg: string } =>
          typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string'
      );
      if (firstMessage) return firstMessage.msg;
    }
  } catch {
    // The status-based message below also covers non-JSON error responses.
  }

  return `The BeatFit API returned an error (${response.status}).`;
}
