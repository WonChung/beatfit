import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  BeatFitStorageSchema,
  GeneratedWorkoutRecord,
  SavedWorkout,
} from '@/types/persistence';
import type {
  Difficulty,
  Equipment,
  GenerateWorkoutRequest,
  GenerateWorkoutResponse,
  MuscleGroup,
  WorkoutFeedback,
  WorkoutSession,
} from '@/types/workout';

export const STORAGE_SCHEMA_VERSION = 1;
export const STORAGE_KEY = '@beatfit/data';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class DuplicateWorkoutNameError extends Error {
  constructor(name: string) {
    super(`A saved workout named "${name}" already exists.`);
    this.name = 'DuplicateWorkoutNameError';
  }
}

export class UnsupportedStorageVersionError extends Error {
  constructor(version: number) {
    super(`Storage schema version ${version} is newer than supported version ${STORAGE_SCHEMA_VERSION}.`);
    this.name = 'UnsupportedStorageVersionError';
  }
}

export class BeatFitRepository {
  private operationQueue: Promise<unknown> = Promise.resolve();
  private sequence = 0;

  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  async read(): Promise<BeatFitStorageSchema> {
    await this.operationQueue.catch(() => undefined);
    return this.readUnqueued();
  }

  addGeneratedWorkout(
    request: GenerateWorkoutRequest,
    workout: GenerateWorkoutResponse
  ): Promise<GeneratedWorkoutRecord> {
    return this.update((database) => {
      const record: GeneratedWorkoutRecord = {
        id: this.createId('generated'),
        request,
        workout,
        generatedAt: new Date().toISOString(),
      };
      return [{ ...database, generatedWorkouts: [record, ...database.generatedWorkouts] }, record];
    });
  }

  saveWorkout(
    name: string,
    request: GenerateWorkoutRequest,
    workout: GenerateWorkoutResponse
  ): Promise<SavedWorkout> {
    return this.update((database) => {
      const normalizedName = requireWorkoutName(name);
      assertUniqueName(database.savedWorkouts, normalizedName);
      const timestamp = new Date().toISOString();
      const savedWorkout: SavedWorkout = {
        id: this.createId('saved'),
        name: normalizedName,
        request,
        workout,
        createdAt: timestamp,
        updatedAt: timestamp,
        isFavorite: false,
      };
      return [{ ...database, savedWorkouts: [savedWorkout, ...database.savedWorkouts] }, savedWorkout];
    });
  }

  renameWorkout(id: string, name: string): Promise<SavedWorkout> {
    return this.update((database) => {
      const normalizedName = requireWorkoutName(name);
      assertUniqueName(database.savedWorkouts, normalizedName, id);
      const existing = database.savedWorkouts.find((item) => item.id === id);
      if (!existing) throw new Error('Saved workout not found.');
      const updated = { ...existing, name: normalizedName, updatedAt: new Date().toISOString() };
      return [
        {
          ...database,
          savedWorkouts: database.savedWorkouts.map((item) => (item.id === id ? updated : item)),
        },
        updated,
      ];
    });
  }

  toggleFavorite(id: string): Promise<SavedWorkout> {
    return this.update((database) => {
      const existing = database.savedWorkouts.find((item) => item.id === id);
      if (!existing) throw new Error('Saved workout not found.');
      const updated = {
        ...existing,
        isFavorite: !existing.isFavorite,
        updatedAt: new Date().toISOString(),
      };
      return [
        {
          ...database,
          savedWorkouts: database.savedWorkouts.map((item) => (item.id === id ? updated : item)),
        },
        updated,
      ];
    });
  }

  deleteWorkout(id: string): Promise<void> {
    return this.update((database) => [
      { ...database, savedWorkouts: database.savedWorkouts.filter((item) => item.id !== id) },
      undefined,
    ]);
  }

  saveSession(session: WorkoutSession): Promise<WorkoutSession> {
    return this.update((database) => {
      const sessions = [session, ...database.sessions.filter((item) => item.id !== session.id)];
      return [{ ...database, sessions }, session];
    });
  }

  updateSessionFeedback(id: string, feedback: WorkoutFeedback): Promise<WorkoutSession> {
    return this.update((database) => {
      const existing = database.sessions.find((item) => item.id === id);
      if (!existing) throw new Error('Workout session not found.');
      const updated = { ...existing, feedback };
      return [
        {
          ...database,
          sessions: database.sessions.map((item) => (item.id === id ? updated : item)),
        },
        updated,
      ];
    });
  }

  private update<T>(
    mutate: (database: BeatFitStorageSchema) => [BeatFitStorageSchema, T]
  ): Promise<T> {
    const operation = this.operationQueue.then(async () => {
      const database = await this.readUnqueued();
      const [nextDatabase, result] = mutate(database);
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(nextDatabase));
      return result;
    });
    this.operationQueue = operation.catch(() => undefined);
    return operation;
  }

  private async readUnqueued(): Promise<BeatFitStorageSchema> {
    const rawValue = await this.storage.getItem(STORAGE_KEY);
    if (!rawValue) return emptyDatabase();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return emptyDatabase();
    }
    return migrateStorage(parsed);
  }

  private createId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${Date.now()}-${this.sequence}`;
  }
}

export const beatFitRepository = new BeatFitRepository();

export function migrateStorage(value: unknown): BeatFitStorageSchema {
  if (!isRecord(value)) return emptyDatabase();
  const version = typeof value.version === 'number' ? value.version : 0;
  if (version > STORAGE_SCHEMA_VERSION) throw new UnsupportedStorageVersionError(version);

  if (version === 0) {
    return sanitizeV1({
      version: 1,
      generatedWorkouts: value.generatedWorkouts ?? [],
      savedWorkouts: value.savedWorkouts ?? [],
      sessions: value.sessions ?? value.history ?? [],
    });
  }

  return sanitizeV1(value);
}

function sanitizeV1(value: Record<string, unknown>): BeatFitStorageSchema {
  return {
    version: 1,
    generatedWorkouts: deduplicateById(
      arrayOrEmpty(value.generatedWorkouts).filter(isGeneratedWorkoutRecord)
    ),
    savedWorkouts: deduplicateById(arrayOrEmpty(value.savedWorkouts).filter(isSavedWorkout)),
    sessions: deduplicateById(arrayOrEmpty(value.sessions).filter(isWorkoutSession)),
  };
}

function emptyDatabase(): BeatFitStorageSchema {
  return { version: 1, generatedWorkouts: [], savedWorkouts: [], sessions: [] };
}

function requireWorkoutName(name: string): string {
  const normalized = name.trim();
  if (!normalized) throw new Error('Workout name is required.');
  return normalized;
}

function assertUniqueName(savedWorkouts: SavedWorkout[], name: string, excludedId?: string) {
  const duplicate = savedWorkouts.some(
    (item) => item.id !== excludedId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  );
  if (duplicate) throw new DuplicateWorkoutNameError(name);
}

function deduplicateById<T extends { id: string }>(records: T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

function isGeneratedWorkoutRecord(value: unknown): value is GeneratedWorkoutRecord {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isGenerateWorkoutRequest(value.request) &&
    isGenerateWorkoutResponse(value.workout) &&
    isDateString(value.generatedAt)
  );
}

function isSavedWorkout(value: unknown): value is SavedWorkout {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isGenerateWorkoutRequest(value.request) &&
    isGenerateWorkoutResponse(value.workout) &&
    isDateString(value.createdAt) &&
    isDateString(value.updatedAt) &&
    typeof value.isFavorite === 'boolean'
  );
}

function isWorkoutSession(value: unknown): value is WorkoutSession {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isGenerateWorkoutResponse(value.workout) &&
    isDateString(value.startTime) &&
    isDateString(value.endTime) &&
    isNonNegativeNumber(value.plannedDurationSeconds) &&
    isNonNegativeNumber(value.actualElapsedDurationSeconds) &&
    isNonNegativeNumber(value.totalIntervals) &&
    isNonNegativeNumber(value.completedIntervals) &&
    isNonNegativeNumber(value.completedWorkIntervals) &&
    isNonNegativeNumber(value.completedSongBlocks) &&
    (value.status === 'completed' || value.status === 'ended_early') &&
    (value.feedback === undefined ||
      value.feedback === 'too_easy' ||
      value.feedback === 'about_right' ||
      value.feedback === 'too_hard')
  );
}

function isGenerateWorkoutRequest(value: unknown): value is GenerateWorkoutRequest {
  return (
    isRecord(value) &&
    isMuscleGroup(value.muscle_group) &&
    isDifficulty(value.difficulty) &&
    Array.isArray(value.equipment) &&
    value.equipment.every(isEquipment) &&
    Array.isArray(value.songs) &&
    value.songs.every(isSong)
  );
}

function isGenerateWorkoutResponse(value: unknown): value is GenerateWorkoutResponse {
  return (
    isRecord(value) &&
    isMuscleGroup(value.muscle_group) &&
    isDifficulty(value.difficulty) &&
    Array.isArray(value.equipment) &&
    value.equipment.every(isEquipment) &&
    Array.isArray(value.blocks) &&
    value.blocks.every(
      (block) =>
        isRecord(block) &&
        isSong(block.song) &&
        isNonNegativeNumber(block.duration_seconds) &&
        Array.isArray(block.intervals) &&
        block.intervals.every(
          (interval) =>
            isRecord(interval) &&
            isNonNegativeNumber(interval.start_seconds) &&
            isNonNegativeNumber(interval.end_seconds) &&
            typeof interval.type === 'string' &&
            typeof interval.exercise === 'string'
        )
    )
  );
}

function isSong(value: unknown) {
  return (
    isRecord(value) &&
    isNonEmptyString(value.title) &&
    typeof value.artist === 'string' &&
    isNonNegativeNumber(value.duration_ms)
  );
}

function isMuscleGroup(value: unknown): value is MuscleGroup {
  return ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body'].includes(
    value as string
  );
}

function isDifficulty(value: unknown): value is Difficulty {
  return ['beginner', 'intermediate', 'advanced'].includes(value as string);
}

function isEquipment(value: unknown): value is Equipment {
  return ['bodyweight', 'dumbbells', 'gym'].includes(value as string);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
