import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppleMusicError } from './types';
import { appleMusicTestExports, WebAppleMusicService } from './web-adapter';

const authState = vi.hoisted(() => ({
  userId: 'beatfit-user-a' as string | undefined,
}));

vi.mock('../supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: authState.userId
            ? { access_token: `access-${authState.userId}`, user: { id: authState.userId } }
            : null,
        },
        error: null,
      }),
    },
  }),
}));

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

let music: {
  isAuthorized: boolean;
  storefrontId: string;
  authorize: ReturnType<typeof vi.fn>;
  unauthorize: ReturnType<typeof vi.fn>;
  api: { music: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  authState.userId = 'beatfit-user-a';
  const storage = new MemoryStorage();
  music = {
    isAuthorized: false,
    storefrontId: 'us',
    authorize: vi.fn(async () => {
      music.isAuthorized = true;
      return 'music-user-token';
    }),
    unauthorize: vi.fn(async () => {
      music.isAuthorized = false;
    }),
    api: {
      music: vi.fn(async () => ({ data: [] })),
    },
  };
  vi.stubGlobal('window', {
    sessionStorage: storage,
    MusicKit: {
      configure: vi.fn(async () => music),
      getInstance: vi.fn(() => music),
    },
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token: 'developer-token' }), { status: 200 })));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://127.0.0.1:8000');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Apple Music web authorization ownership', () => {
  it('binds MusicKit authorization to the current BeatFit user in tab storage', async () => {
    const service = new WebAppleMusicService('beatfit-user-a');

    await expect(service.authorize()).resolves.toBe('authorized');
    expect(window.sessionStorage.getItem(appleMusicTestExports.ownerKey)).toBe('beatfit-user-a');

    await expect(service.listPlaylists()).resolves.toEqual({ items: [], next: undefined });
    expect(music.api.music).toHaveBeenCalledWith('/v1/me/library/playlists?limit=25');
  });

  it('does not expose an inherited MusicKit library to a different BeatFit user', async () => {
    const firstUser = new WebAppleMusicService('beatfit-user-a');
    await firstUser.authorize();

    authState.userId = 'beatfit-user-b';
    const secondUser = new WebAppleMusicService('beatfit-user-b');
    await expect(secondUser.listPlaylists()).rejects.toMatchObject({ code: 'expired' });

    expect(music.api.music).not.toHaveBeenCalled();
    expect(music.unauthorize).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem(appleMusicTestExports.ownerKey)).toBeNull();

    await expect(secondUser.authorize()).resolves.toBe('authorized');
    expect(window.sessionStorage.getItem(appleMusicTestExports.ownerKey)).toBe('beatfit-user-b');
  });

  it('clears authorization when the BeatFit user changes during MusicKit authorization', async () => {
    let finishAuthorization: (() => void) | undefined;
    music.authorize.mockImplementation(async () => {
      await new Promise<void>((resolve) => { finishAuthorization = resolve; });
      music.isAuthorized = true;
      return 'music-user-token';
    });
    const authorization = new WebAppleMusicService('beatfit-user-a').authorize();
    await vi.waitFor(() => expect(finishAuthorization).toBeTypeOf('function'));

    authState.userId = 'beatfit-user-b';
    finishAuthorization?.();

    await expect(authorization).rejects.toMatchObject({ code: 'expired' });
    expect(music.unauthorize).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem(appleMusicTestExports.ownerKey)).toBeNull();
  });

  it('discards a library response if the BeatFit user changes while it is loading', async () => {
    const service = new WebAppleMusicService('beatfit-user-a');
    await service.authorize();
    let finishRequest: ((payload: unknown) => void) | undefined;
    music.api.music.mockImplementation(() => new Promise((resolve) => { finishRequest = resolve; }));
    const request = service.listPlaylists();
    await vi.waitFor(() => expect(finishRequest).toBeTypeOf('function'));

    authState.userId = 'beatfit-user-b';
    finishRequest?.({ data: [{ id: 'private-a', attributes: { name: 'Private A' } }] });

    await expect(request).rejects.toMatchObject({ code: 'expired' });
    expect(window.sessionStorage.getItem(appleMusicTestExports.ownerKey)).toBeNull();
  });

  it('clears the logical owner even when MusicKit disconnect fails', async () => {
    window.sessionStorage.setItem(appleMusicTestExports.ownerKey, 'beatfit-user-a');
    music.isAuthorized = true;
    music.unauthorize.mockRejectedValueOnce(new Error('provider failure'));

    await expect(new WebAppleMusicService('beatfit-user-a').disconnect()).rejects.toMatchObject({
      code: 'network',
    });
    expect(window.sessionStorage.getItem(appleMusicTestExports.ownerKey)).toBeNull();
  });
});

describe('Apple Music library pagination validation', () => {
  it('accepts only relative MusicKit library paths', () => {
    expect(appleMusicTestExports.safeAppleMusicLibraryPath('/v1/me/library/playlists?offset=25'))
      .toBe('/v1/me/library/playlists?offset=25');

    for (const unsafe of [
      'https://example.com/v1/me/library/playlists',
      '//example.com/v1/me/library/playlists',
      '/v1/catalog/us/songs',
      '/v1/me/library/../../catalog/us/songs',
      '/v1/me/library/playlists#unexpected',
    ]) {
      expect(() => appleMusicTestExports.safeAppleMusicLibraryPath(unsafe))
        .toThrowError(AppleMusicError);
    }
  });

  it('rejects an unsafe next path before returning normalized metadata', () => {
    expect(() => appleMusicTestExports.normalizePage(
      { data: [], next: 'https://example.com/collect' },
      appleMusicTestExports.normalizePlaylist,
    )).toThrowError(AppleMusicError);
  });
});
