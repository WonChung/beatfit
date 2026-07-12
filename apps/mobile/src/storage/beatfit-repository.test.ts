import { describe, expect, it } from '@jest/globals';

import type { GenerateWorkoutRequest, GenerateWorkoutResponse, WorkoutSession } from '@/types/workout';

import {
  BeatFitRepository,
  DuplicateWorkoutNameError,
  STORAGE_KEY,
  migrateStorage,
  type KeyValueStorage,
} from './beatfit-repository';

class MemoryStorage implements KeyValueStorage {
  values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const request: GenerateWorkoutRequest = {
  muscle_group: 'core',
  difficulty: 'intermediate',
  equipment: ['bodyweight'],
  songs: [{ title: 'Song', artist: 'Artist', duration_ms: 30_000 }],
};

const workout: GenerateWorkoutResponse = {
  muscle_group: 'core',
  difficulty: 'intermediate',
  equipment: ['bodyweight'],
  blocks: [
    {
      song: request.songs[0],
      duration_seconds: 30,
      intervals: [{ start_seconds: 0, end_seconds: 30, type: 'work', exercise: 'Plank' }],
    },
  ],
};

const session: WorkoutSession = {
  id: 'session-1',
  workout,
  startTime: new Date(0).toISOString(),
  endTime: new Date(30_000).toISOString(),
  plannedDurationSeconds: 30,
  actualElapsedDurationSeconds: 30,
  totalIntervals: 1,
  completedIntervals: 1,
  completedWorkIntervals: 1,
  completedSongBlocks: 1,
  status: 'completed',
};

describe('BeatFitRepository', () => {
  it('saves and reads generated and named workouts', async () => {
    const repository = new BeatFitRepository(new MemoryStorage());
    await repository.addGeneratedWorkout(request, workout);
    const saved = await repository.saveWorkout('Core Session', request, workout);
    const database = await repository.read();

    expect(database.generatedWorkouts).toHaveLength(1);
    expect(database.savedWorkouts).toEqual([saved]);
    expect(database.version).toBe(1);
  });

  it('renames workouts and rejects duplicate names case-insensitively', async () => {
    const repository = new BeatFitRepository(new MemoryStorage());
    const first = await repository.saveWorkout('Core Session', request, workout);
    await repository.saveWorkout('Morning Core', request, workout);
    const renamed = await repository.renameWorkout(first.id, 'Evening Core');

    expect(renamed.name).toBe('Evening Core');
    await expect(repository.renameWorkout(first.id, 'morning core')).rejects.toBeInstanceOf(
      DuplicateWorkoutNameError
    );
  });

  it('deletes a saved workout', async () => {
    const repository = new BeatFitRepository(new MemoryStorage());
    const saved = await repository.saveWorkout('Delete Me', request, workout);
    await repository.deleteWorkout(saved.id);
    expect((await repository.read()).savedWorkouts).toEqual([]);
  });

  it('favorites and unfavorites a workout', async () => {
    const repository = new BeatFitRepository(new MemoryStorage());
    const saved = await repository.saveWorkout('Favorite', request, workout);
    expect((await repository.toggleFavorite(saved.id)).isFavorite).toBe(true);
    expect((await repository.toggleFavorite(saved.id)).isFavorite).toBe(false);
  });

  it('stores history entries and persists feedback updates', async () => {
    const repository = new BeatFitRepository(new MemoryStorage());
    await repository.saveSession(session);
    await repository.updateSessionFeedback(session.id, 'about_right');
    const history = (await repository.read()).sessions;

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: session.id, feedback: 'about_right' });
  });

  it('recovers from malformed JSON and drops partially corrupt records', async () => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEY, '{not-json');
    const repository = new BeatFitRepository(storage);
    expect(await repository.read()).toEqual({
      version: 1,
      generatedWorkouts: [],
      savedWorkouts: [],
      sessions: [],
    });

    storage.values.set(
      STORAGE_KEY,
      JSON.stringify({ version: 1, generatedWorkouts: [{ id: 'broken' }], savedWorkouts: [], sessions: [session, { id: 'bad' }] })
    );
    expect((await repository.read()).sessions).toEqual([session]);
    expect((await repository.read()).generatedWorkouts).toEqual([]);
  });

  it('migrates version-zero history and deduplicates IDs', () => {
    const migrated = migrateStorage({
      version: 0,
      savedWorkouts: [],
      history: [session, { ...session, feedback: 'too_hard' }],
    });

    expect(migrated.version).toBe(1);
    expect(migrated.generatedWorkouts).toEqual([]);
    expect(migrated.sessions).toEqual([session]);
  });
});
