import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  createMigratingAuthStorage,
  type AuthKeyValueStorage,
} from '@/services/auth-storage';

type MockAuthStorage = {
  getItem: jest.MockedFunction<AuthKeyValueStorage['getItem']>;
  setItem: jest.MockedFunction<AuthKeyValueStorage['setItem']>;
  removeItem: jest.MockedFunction<AuthKeyValueStorage['removeItem']>;
};

function mockStorage(
  overrides: Partial<MockAuthStorage> = {}
): MockAuthStorage {
  return {
    getItem: jest.fn(async (_key: string) => null),
    setItem: jest.fn(async (_key: string, _value: string) => undefined),
    removeItem: jest.fn(async (_key: string) => undefined),
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('native Supabase auth storage', () => {
  it('returns protected data without reading legacy storage', async () => {
    const secureStorage = mockStorage({
      getItem: jest.fn(async () => 'secure-session'),
    });
    const legacyStorage = mockStorage({
      getItem: jest.fn(async () => 'stale-legacy-session'),
    });
    const storage = createMigratingAuthStorage({ secureStorage, legacyStorage });

    await expect(storage.getItem('supabase-auth-key')).resolves.toBe('secure-session');
    expect(secureStorage.getItem).toHaveBeenCalledWith('supabase-auth-key');
    expect(legacyStorage.getItem).not.toHaveBeenCalled();
    expect(secureStorage.setItem).not.toHaveBeenCalled();
    expect(legacyStorage.removeItem).not.toHaveBeenCalled();
  });

  it('migrates legacy data and removes it only after the protected write succeeds', async () => {
    const events: string[] = [];
    const secureStorage = mockStorage({
      getItem: jest.fn(async () => {
        events.push('secure:get');
        return null;
      }),
      setItem: jest.fn(async () => {
        events.push('secure:set');
      }),
    });
    const legacyStorage = mockStorage({
      getItem: jest.fn(async () => {
        events.push('legacy:get');
        return 'legacy-session';
      }),
      removeItem: jest.fn(async () => {
        events.push('legacy:remove');
      }),
    });
    const storage = createMigratingAuthStorage({ secureStorage, legacyStorage });

    await expect(storage.getItem('supabase-auth-key')).resolves.toBe('legacy-session');
    expect(secureStorage.setItem).toHaveBeenCalledWith(
      'supabase-auth-key',
      'legacy-session'
    );
    expect(legacyStorage.removeItem).toHaveBeenCalledWith('supabase-auth-key');
    expect(events).toEqual(['secure:get', 'legacy:get', 'secure:set', 'legacy:remove']);
  });

  it('retains legacy data when the protected migration write fails', async () => {
    const migrationError = new Error('Protected storage unavailable');
    const secureStorage = mockStorage({
      setItem: jest.fn(async () => {
        throw migrationError;
      }),
    });
    const legacyStorage = mockStorage({
      getItem: jest.fn(async () => 'legacy-session'),
    });
    const storage = createMigratingAuthStorage({ secureStorage, legacyStorage });

    await expect(storage.getItem('supabase-auth-key')).rejects.toBe(migrationError);
    expect(legacyStorage.getItem).toHaveBeenCalledWith('supabase-auth-key');
    expect(legacyStorage.removeItem).not.toHaveBeenCalled();
  });

  it('writes protected data before removing a legacy copy and deletes both stores', async () => {
    const events: string[] = [];
    const secureStorage = mockStorage({
      setItem: jest.fn(async () => {
        events.push('secure:set');
      }),
      removeItem: jest.fn(async () => {
        events.push('secure:remove');
      }),
    });
    const legacyStorage = mockStorage({
      removeItem: jest.fn(async () => {
        events.push('legacy:remove');
      }),
    });
    const storage = createMigratingAuthStorage({ secureStorage, legacyStorage });

    await storage.setItem('supabase-auth-key', 'new-session');
    expect(events).toEqual(['secure:set', 'legacy:remove']);

    events.length = 0;
    await storage.removeItem('supabase-auth-key');
    expect(events).toEqual(expect.arrayContaining(['secure:remove', 'legacy:remove']));
  });

  it('never logs stored session values', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const secureStorage = mockStorage();
    const legacyStorage = mockStorage({
      getItem: jest.fn(async () => 'sensitive-session-value'),
    });
    const storage = createMigratingAuthStorage({ secureStorage, legacyStorage });

    await storage.getItem('supabase-auth-key');
    await storage.setItem('supabase-auth-key', 'replacement-sensitive-value');
    await storage.removeItem('supabase-auth-key');

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
