import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spotifyApiPlaylistPageFixture, spotifyApiTrackPageFixture } from './fixtures';
import { SpotifyMusicError } from './types';
import { WebSpotifyMusicService, spotifyTestExports } from './web-adapter';

const BEATFIT_USER_ID = 'beatfit-user-1';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SPOTIFY_CLIENT_ID', 'public-client-id');
  vi.stubEnv('NEXT_PUBLIC_SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:3000/auth/spotify/callback');
  vi.stubGlobal('window', {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    location: { origin: 'http://127.0.0.1:3000', assign: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Spotify Web API metadata normalization', () => {
  it('starts PKCE authorization with both playlist scopes and no client secret', async () => {
    await new WebSpotifyMusicService(BEATFIT_USER_ID).authorize();

    const assign = window.location.assign as ReturnType<typeof vi.fn>;
    const authorizationUrl = new URL(assign.mock.calls[0][0]);
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('scope')?.split(' ').sort()).toEqual([
      'playlist-read-collaborative',
      'playlist-read-private',
    ]);
    expect(authorizationUrl.searchParams.has('client_secret')).toBe(false);
  });

  it('reports a cancelled callback after validating its state', async () => {
    window.sessionStorage.setItem('beatfit.spotify.oauth_state', 'expected-state');
    window.sessionStorage.setItem('beatfit.spotify.pkce_verifier', 'verifier');
    window.sessionStorage.setItem('beatfit.spotify.pkce_owner', BEATFIT_USER_ID);

    await expect(new WebSpotifyMusicService(BEATFIT_USER_ID).completeAuthorization(
      new URLSearchParams('error=access_denied&state=expected-state'),
    )).resolves.toBe('cancelled');
  });

  it('does not store a token when the BeatFit user changes during the exchange', async () => {
    window.sessionStorage.setItem('beatfit.spotify.oauth_state', 'expected-state');
    window.sessionStorage.setItem('beatfit.spotify.pkce_verifier', 'verifier');
    window.sessionStorage.setItem('beatfit.spotify.pkce_owner', BEATFIT_USER_ID);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      scope: 'playlist-read-private playlist-read-collaborative',
    })));

    await expect(new WebSpotifyMusicService(BEATFIT_USER_ID).completeAuthorization(
      new URLSearchParams('code=authorization-code&state=expected-state'),
      async () => false,
    )).rejects.toMatchObject({ code: 'invalid_state' });
    expect(window.sessionStorage.getItem('beatfit.spotify.token')).toBeNull();
  });

  it('rejects stored authorization that is missing a playlist scope', async () => {
    window.sessionStorage.setItem('beatfit.spotify.token', JSON.stringify({
      accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 60_000, scopes: ['playlist-read-private'], beatFitUserId: BEATFIT_USER_ID,
    }));

    await expect(new WebSpotifyMusicService(BEATFIT_USER_ID).authorizationStatus()).resolves.toBe('missing_permissions');
  });

  it('does not restore a Spotify token for a different BeatFit user', async () => {
    window.sessionStorage.setItem('beatfit.spotify.token', JSON.stringify({
      accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 60_000,
      scopes: ['playlist-read-private', 'playlist-read-collaborative'], beatFitUserId: BEATFIT_USER_ID,
    }));

    await expect(new WebSpotifyMusicService('beatfit-user-2').authorizationStatus()).resolves.toBe('disconnected');
    expect(window.sessionStorage.getItem('beatfit.spotify.token')).toBeNull();
  });

  it('uses the current playlist items field and preserves pagination', () => {
    const page = spotifyTestExports.normalizePage(spotifyApiPlaylistPageFixture, spotifyTestExports.normalizePlaylist);
    expect(page.items[0]).toMatchObject({ id: 'playlist-1', name: 'Morning Run', trackCount: 4 });
    expect(page.next).toContain('offset=50');
  });

  it('handles current item wrappers, local files, unavailable items, and non-tracks', () => {
    const page = spotifyTestExports.normalizePage(spotifyApiTrackPageFixture, spotifyTestExports.normalizePlaylistItem);
    expect(page.items[0]).toMatchObject({ id: 'track-1:0', isPlayable: true, title: 'Fast Song' });
    expect(page.items[0].provider_identifier?.provider).toBe('spotify');
    expect(page.items[1]).toMatchObject({ isPlayable: false, unavailableReason: 'local' });
    expect(page.items[2]).toMatchObject({ isPlayable: false, unavailableReason: 'missing_metadata' });
    expect(page.items[3]).toMatchObject({ isPlayable: false, unavailableReason: 'not_track' });
  });

  it('rejects pagination links outside the Spotify API origin', () => {
    expect(() => spotifyTestExports.normalizePage({ items: [], next: 'https://example.com/steal' }, spotifyTestExports.normalizePlaylist))
      .toThrowError(SpotifyMusicError);
  });

  it('refreshes an expired PKCE token without a client secret', async () => {
    window.sessionStorage.setItem('beatfit.spotify.token', JSON.stringify({
      accessToken: 'old-access', refreshToken: 'refresh-token', expiresAt: 0, scopes: ['playlist-read-private', 'playlist-read-collaborative'], beatFitUserId: BEATFIT_USER_ID,
    }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'new-access', expires_in: 3600, scope: 'playlist-read-private playlist-read-collaborative',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await new WebSpotifyMusicService(BEATFIT_USER_ID).authorizationStatus()).toBe('authorized');
    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get('refresh_token')).toBe('refresh-token');
    expect(body.has('client_secret')).toBe(false);
    expect(JSON.parse(window.sessionStorage.getItem('beatfit.spotify.token') ?? '{}')).toMatchObject({
      accessToken: 'new-access', refreshToken: 'refresh-token',
    });
  });

  it('surfaces rate limits with Retry-After guidance', async () => {
    window.sessionStorage.setItem('beatfit.spotify.token', JSON.stringify({
      accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 60_000, scopes: ['playlist-read-private', 'playlist-read-collaborative'], beatFitUserId: BEATFIT_USER_ID,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '7' } })));

    await expect(new WebSpotifyMusicService(BEATFIT_USER_ID).listPlaylists()).rejects.toMatchObject({
      code: 'rate_limited', retryAfterSeconds: 7,
    });
  });

  it('surfaces a Development Mode denial during token refresh', async () => {
    window.sessionStorage.setItem('beatfit.spotify.token', JSON.stringify({
      accessToken: 'old-access', refreshToken: 'refresh-token', expiresAt: 0,
      scopes: ['playlist-read-private', 'playlist-read-collaborative'], beatFitUserId: BEATFIT_USER_ID,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));

    await expect(new WebSpotifyMusicService(BEATFIT_USER_ID).authorizationStatus()).rejects.toMatchObject({
      code: 'development_restricted',
    });
  });

  it('explains Development Mode or permission restrictions', async () => {
    window.sessionStorage.setItem('beatfit.spotify.token', JSON.stringify({
      accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 60_000, scopes: ['playlist-read-private', 'playlist-read-collaborative'], beatFitUserId: BEATFIT_USER_ID,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));

    await expect(new WebSpotifyMusicService(BEATFIT_USER_ID).listPlaylists()).rejects.toMatchObject({
      code: 'development_restricted',
    });
  });
});
