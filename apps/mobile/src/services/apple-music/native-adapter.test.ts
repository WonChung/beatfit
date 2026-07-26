import { describe, expect, it, jest } from '@jest/globals';

import {
  NativeAppleMusicService,
  type NativeAppleMusicDependencies,
  type NativeAppleMusicModule,
} from './native-adapter';

class MemoryOwnerStorage {
  readonly values = new Map<string, string>();

  async getItemAsync(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string) {
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string) {
    this.values.delete(key);
  }
}

function nativeModule(): NativeAppleMusicModule & {
  authorizationStatus: jest.Mock<NativeAppleMusicModule['authorizationStatus']>;
  authorize: jest.Mock<NativeAppleMusicModule['authorize']>;
  disconnect: jest.Mock<NativeAppleMusicModule['disconnect']>;
  listPlaylists: jest.Mock<NativeAppleMusicModule['listPlaylists']>;
} {
  return {
    authorizationStatus: jest.fn(async () => 'authorized' as const),
    authorize: jest.fn(async () => 'authorized' as const),
    disconnect: jest.fn(async () => undefined),
    listPlaylists: jest.fn(async () => ({ items: [{ id: 'playlist-1', name: 'Workout' }] })),
    getPlaylistTracks: jest.fn(async () => ({ items: [] })),
  };
}

function serviceFixture(module: NativeAppleMusicModule | null = nativeModule()) {
  let userId: string | null = 'user-a';
  const ownerStorage = new MemoryOwnerStorage();
  const getSession: NativeAppleMusicDependencies['getSession'] = jest.fn(async () =>
    userId ? { userId, accessToken: `token-for-${userId}` } : null
  );
  const service = new NativeAppleMusicService({
    nativeModule: module,
    ownerStorage,
    getSession,
    platform: 'ios',
    fetcher: jest.fn<typeof fetch>(),
  });

  return {
    service,
    ownerStorage,
    setUserId(nextUserId: string | null) {
      userId = nextUserId;
    },
  };
}

describe('NativeAppleMusicService account ownership', () => {
  it('restores an authorized logical connection only for the BeatFit owner', async () => {
    const module = nativeModule();
    const { service, ownerStorage } = serviceFixture(module);

    await expect(service.authorize()).resolves.toBe('authorized');
    expect([...ownerStorage.values.values()]).toEqual([
      JSON.stringify({ beatFitUserId: 'user-a' }),
    ]);
    await expect(service.authorizationStatus()).resolves.toBe('authorized');
    expect(module.authorizationStatus).toHaveBeenCalledTimes(1);
  });

  it('does not expose one BeatFit user Apple Music connection to another user', async () => {
    const module = nativeModule();
    const { service, ownerStorage, setUserId } = serviceFixture(module);
    await service.authorize();

    setUserId('user-b');

    await expect(service.authorizationStatus()).resolves.toBe('not_determined');
    expect(ownerStorage.values.size).toBe(0);
    expect(module.disconnect).toHaveBeenCalledTimes(1);
    expect(module.authorizationStatus).not.toHaveBeenCalled();
    await expect(service.listPlaylists()).rejects.toMatchObject({ code: 'expired' });
    expect(module.listPlaylists).not.toHaveBeenCalled();
  });

  it('clears owner metadata when native disconnect fails', async () => {
    const module = nativeModule();
    const { service, ownerStorage } = serviceFixture(module);
    await service.authorize();
    module.disconnect.mockRejectedValueOnce(new Error('native failure'));

    await expect(service.disconnect()).rejects.toThrow('native failure');
    expect(ownerStorage.values.size).toBe(0);
  });

  it('clears owner metadata when the native module is unavailable', async () => {
    const module = nativeModule();
    const fixture = serviceFixture(module);
    await fixture.service.authorize();
    const unavailableService = new NativeAppleMusicService({
      nativeModule: null,
      ownerStorage: fixture.ownerStorage,
      getSession: async () => ({ userId: 'user-a', accessToken: 'token' }),
      platform: 'ios',
      fetcher: jest.fn<typeof fetch>(),
    });

    await expect(unavailableService.disconnect()).rejects.toMatchObject({ code: 'unavailable' });
    expect(fixture.ownerStorage.values.size).toBe(0);
  });

  it('revokes a connection when the BeatFit user changes during authorization', async () => {
    const module = nativeModule();
    const fixture = serviceFixture(module);
    module.authorize.mockImplementationOnce(async () => {
      fixture.setUserId('user-b');
      return 'authorized';
    });

    await expect(fixture.service.authorize()).rejects.toMatchObject({ code: 'expired' });
    expect(fixture.ownerStorage.values.size).toBe(0);
    expect(module.disconnect).toHaveBeenCalledTimes(1);
  });
});
