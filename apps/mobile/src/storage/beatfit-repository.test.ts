import { describe, expect, it } from '@jest/globals';

import type { GenerateWorkoutRequest, GenerateWorkoutResponse, WorkoutSession } from '@/types/workout';

import {
  createBeatFitRepository,
  DuplicateWorkoutNameError,
  LEGACY_STORAGE_KEY,
  migrateStorage,
  storageKeyForUser,
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

const USER_A_ID = '11111111-1111-4111-8111-111111111111';
const USER_B_ID = '22222222-2222-4222-8222-222222222222';

describe('BeatFitRepository', () => {
  it('saves and reads generated and named workouts', async () => {
    const repository = createBeatFitRepository(USER_A_ID, new MemoryStorage());
    await repository.addGeneratedWorkout(request, workout);
    const saved = await repository.saveWorkout('Core Session', request, workout);
    const database = await repository.read();

    expect(database.generatedWorkouts).toHaveLength(1);
    expect(database.savedWorkouts).toEqual([saved]);
    expect(database.version).toBe(1);
  });

  it('renames workouts and rejects duplicate names case-insensitively', async () => {
    const repository = createBeatFitRepository(USER_A_ID, new MemoryStorage());
    const first = await repository.saveWorkout('Core Session', request, workout);
    await repository.saveWorkout('Morning Core', request, workout);
    const renamed = await repository.renameWorkout(first.id, 'Evening Core');

    expect(renamed.name).toBe('Evening Core');
    await expect(repository.renameWorkout(first.id, 'morning core')).rejects.toBeInstanceOf(
      DuplicateWorkoutNameError
    );
  });

  it('deletes a saved workout', async () => {
    const repository = createBeatFitRepository(USER_A_ID, new MemoryStorage());
    const saved = await repository.saveWorkout('Delete Me', request, workout);
    await repository.deleteWorkout(saved.id);
    expect((await repository.read()).savedWorkouts).toEqual([]);
  });

  it('favorites and unfavorites a workout', async () => {
    const repository = createBeatFitRepository(USER_A_ID, new MemoryStorage());
    const saved = await repository.saveWorkout('Favorite', request, workout);
    expect((await repository.toggleFavorite(saved.id)).isFavorite).toBe(true);
    expect((await repository.toggleFavorite(saved.id)).isFavorite).toBe(false);
  });

  it('stores history entries and persists feedback updates', async () => {
    const repository = createBeatFitRepository(USER_A_ID, new MemoryStorage());
    await repository.saveSession(session);
    await repository.updateSessionFeedback(session.id, 'about_right');
    const history = (await repository.read()).sessions;

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: session.id, feedback: 'about_right' });
  });

  it('recovers from malformed JSON and drops partially corrupt records', async () => {
    const storage = new MemoryStorage();
    const storageKey = storageKeyForUser(USER_A_ID);
    storage.values.set(storageKey, '{not-json');
    const repository = createBeatFitRepository(USER_A_ID, storage);
    expect(await repository.read()).toEqual({
      version: 1,
      generatedWorkouts: [],
      savedWorkouts: [],
      sessions: [],
    });

    storage.values.set(
      storageKey,
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

  it('derives deterministic, collision-resistant keys from user IDs', () => {
    expect(storageKeyForUser(' user/a ')).toBe(`${LEGACY_STORAGE_KEY}/user/user%2Fa`);
    expect(storageKeyForUser('user/a')).toBe(storageKeyForUser(' user/a '));
    expect(storageKeyForUser('user/a')).not.toBe(storageKeyForUser('user%2Fa'));
    expect(() => storageKeyForUser('   ')).toThrow('user ID is required');
  });

  it('isolates account A and account B in the same storage adapter', async () => {
    const storage = new MemoryStorage();
    const accountA = createBeatFitRepository(USER_A_ID, storage);
    const accountB = createBeatFitRepository(USER_B_ID, storage);

    await accountA.saveWorkout('Account A workout', request, workout);
    await accountB.saveWorkout('Account B workout', request, workout);

    expect((await accountA.read()).savedWorkouts.map((item) => item.name)).toEqual([
      'Account A workout',
    ]);
    expect((await accountB.read()).savedWorkouts.map((item) => item.name)).toEqual([
      'Account B workout',
    ]);
    expect(storage.values.has(storageKeyForUser(USER_A_ID))).toBe(true);
    expect(storage.values.has(storageKeyForUser(USER_B_ID))).toBe(true);
  });

  it('preserves serialized updates within a user-scoped repository', async () => {
    const repository = createBeatFitRepository(USER_A_ID, new MemoryStorage());

    await Promise.all([
      repository.saveWorkout('First concurrent workout', request, workout),
      repository.saveWorkout('Second concurrent workout', request, workout),
    ]);

    expect(
      (await repository.read()).savedWorkouts.map((item) => item.name).sort()
    ).toEqual(['First concurrent workout', 'Second concurrent workout']);
  });

  it('restores the same account after logout and repository recreation', async () => {
    const storage = new MemoryStorage();
    const beforeLogout = createBeatFitRepository(USER_A_ID, storage);
    const saved = await beforeLogout.saveWorkout('Restored workout', request, workout);
    await beforeLogout.saveSession(session);

    const afterLogin = createBeatFitRepository(USER_A_ID, storage);
    const restored = await afterLogin.read();

    expect(restored.savedWorkouts).toEqual([saved]);
    expect(restored.sessions).toEqual([session]);
  });

  it('never exposes data from the unowned legacy storage key', async () => {
    const storage = new MemoryStorage();
    const legacyValue = JSON.stringify({
      version: 1,
      generatedWorkouts: [],
      savedWorkouts: [],
      sessions: [session],
    });
    storage.values.set(LEGACY_STORAGE_KEY, legacyValue);

    const repository = createBeatFitRepository(USER_A_ID, storage);
    expect((await repository.read()).sessions).toEqual([]);

    await repository.saveSession({ ...session, id: 'owned-session' });

    expect((await repository.read()).sessions.map((item) => item.id)).toEqual(['owned-session']);
    expect(storage.values.get(LEGACY_STORAGE_KEY)).toBe(legacyValue);
  });
});
