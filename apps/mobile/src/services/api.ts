import type { GenerateWorkoutRequest, GenerateWorkoutResponse } from '@/types/workout';

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
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/workouts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new ApiError('Could not reach the BeatFit API. Check the API URL and your connection.');
  }

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response), response.status);
  }

  return (await response.json()) as GenerateWorkoutResponse;
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') {
      return body.detail;
    }
  } catch {
    // The status-based message below also covers non-JSON error responses.
  }

  return `The BeatFit API returned an error (${response.status}).`;
}
