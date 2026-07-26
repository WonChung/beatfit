"use client";

import type { SpotifyMusicService, SpotifyPage, SpotifyPlaylist, SpotifyTrack } from './types';
import { SpotifyMusicError } from './types';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_ORIGIN = 'https://api.spotify.com';
const REQUIRED_SCOPES = ['playlist-read-private', 'playlist-read-collaborative'];
const TOKEN_KEY = 'beatfit.spotify.token';
const VERIFIER_KEY = 'beatfit.spotify.pkce_verifier';
const STATE_KEY = 'beatfit.spotify.oauth_state';
const PKCE_OWNER_KEY = 'beatfit.spotify.pkce_owner';
const TOKEN_EXPIRY_SKEW_MS = 30_000;

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  beatFitUserId: string;
}

interface TokenPayload {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
}

export class WebSpotifyMusicService implements SpotifyMusicService {
  constructor(private readonly beatFitUserId: string) {
    if (!beatFitUserId) throw new SpotifyMusicError('A BeatFit session is required to connect Spotify.', 'unavailable');
  }

  async authorizationStatus() {
    const stored = readStoredToken(this.beatFitUserId);
    if (!stored) return 'disconnected' as const;
    try {
      await this.validAccessToken();
      return 'authorized' as const;
    } catch (error) {
      if (error instanceof SpotifyMusicError && error.code === 'missing_permissions') return 'missing_permissions' as const;
      if (error instanceof SpotifyMusicError && error.code === 'expired') return 'expired' as const;
      throw error;
    }
  }

  async authorize(): Promise<void> {
    const { clientId, redirectUri } = spotifyConfig();
    const verifier = randomUrlSafeString(64);
    const state = randomUrlSafeString(32);
    const challenge = await pkceChallenge(verifier);
    window.sessionStorage.setItem(VERIFIER_KEY, verifier);
    window.sessionStorage.setItem(STATE_KEY, state);
    window.sessionStorage.setItem(PKCE_OWNER_KEY, this.beatFitUserId);

    const url = new URL(SPOTIFY_AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: REQUIRED_SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    }).toString();
    window.location.assign(url.toString());
  }

  async completeAuthorization(
    search: URLSearchParams,
    isCurrentBeatFitUser: () => Promise<boolean> = async () => true,
  ) {
    const expectedState = window.sessionStorage.getItem(STATE_KEY);
    const expectedOwner = window.sessionStorage.getItem(PKCE_OWNER_KEY);
    const returnedState = search.get('state');
    const verifier = window.sessionStorage.getItem(VERIFIER_KEY);
    clearPendingAuthorization();

    if (
      !expectedState
      || !returnedState
      || !constantTimeEqual(expectedState, returnedState)
      || expectedOwner !== this.beatFitUserId
    ) {
      throw new SpotifyMusicError('Spotify authorization could not be verified. Please try again.', 'invalid_state');
    }
    if (search.get('error') === 'access_denied') return 'cancelled' as const;
    if (search.has('error')) throw new SpotifyMusicError('Spotify authorization failed.', 'unavailable');
    const code = search.get('code');
    if (!code || !verifier) throw new SpotifyMusicError('Spotify did not return a valid authorization code.', 'invalid_response');

    const { clientId, redirectUri } = spotifyConfig();
    const payload = await tokenRequest(new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }));
    let ownershipIsCurrent = false;
    try {
      ownershipIsCurrent = await isCurrentBeatFitUser();
    } catch {
      ownershipIsCurrent = false;
    }
    if (!ownershipIsCurrent) {
      throw new SpotifyMusicError(
        'Your BeatFit session changed during Spotify authorization. Please try again.',
        'invalid_state',
      );
    }
    storeToken(payload, this.beatFitUserId);
    return 'authorized' as const;
  }

  async disconnect() {
    window.sessionStorage.removeItem(TOKEN_KEY);
    clearPendingAuthorization();
  }

  async listPlaylists(page = `${SPOTIFY_API_ORIGIN}/v1/me/playlists?limit=50`) {
    const payload = await this.apiRequest(page);
    return normalizePage(payload, normalizePlaylist);
  }

  async getPlaylistTracks(playlistId: string, page?: string) {
    const url = page ?? `${SPOTIFY_API_ORIGIN}/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=50`;
    const payload = await this.apiRequest(url);
    return normalizePage(payload, normalizePlaylistItem);
  }

  private async apiRequest(urlValue: string, hasRetried = false): Promise<unknown> {
    const url = safeSpotifyApiUrl(urlValue);
    const token = await this.validAccessToken();
    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new SpotifyMusicError('Could not reach Spotify. Check your connection and try again.', 'network');
    }
    if (response.status === 401 && !hasRetried) {
      await this.refreshAccessToken();
      return this.apiRequest(url.toString(), true);
    }
    if (response.status === 401) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      throw new SpotifyMusicError('Spotify authorization expired. Connect again.', 'expired');
    }
    if (response.status === 403) {
      const details = await spotifyErrorMessage(response);
      if (url.pathname.includes('/playlists/') && url.pathname.endsWith('/items')) {
        throw new SpotifyMusicError(
          details || 'Spotify only exposes items for playlists you own or collaborate on in the current API mode.',
          'playlist_restricted',
        );
      }
      throw new SpotifyMusicError(
        details || 'This Spotify account is not allowed to use the app in Development Mode, or a required permission is missing.',
        'development_restricted',
      );
    }
    if (response.status === 429) {
      const retryAfter = positiveInteger(response.headers.get('Retry-After'));
      throw new SpotifyMusicError(
        retryAfter ? `Spotify rate limit reached. Try again in ${retryAfter} seconds.` : 'Spotify rate limit reached. Try again shortly.',
        'rate_limited',
        retryAfter,
      );
    }
    if (!response.ok) {
      throw new SpotifyMusicError((await spotifyErrorMessage(response)) || 'Spotify could not load this library.', 'network');
    }
    try {
      return await response.json();
    } catch {
      throw new SpotifyMusicError('Spotify returned invalid metadata.', 'invalid_response');
    }
  }

  private async validAccessToken() {
    const token = readStoredToken(this.beatFitUserId);
    if (!token) throw new SpotifyMusicError('Connect Spotify to browse your playlists.', 'expired');
    assertRequiredScopes(token.scopes);
    if (Date.now() + TOKEN_EXPIRY_SKEW_MS >= token.expiresAt) return this.refreshAccessToken();
    return token.accessToken;
  }

  private async refreshAccessToken() {
    const current = readStoredToken(this.beatFitUserId);
    if (!current?.refreshToken) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      throw new SpotifyMusicError('Spotify authorization expired. Connect again.', 'expired');
    }
    const { clientId } = spotifyConfig();
    let payload: TokenPayload;
    try {
      payload = await tokenRequest(new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
      }));
    } catch (error) {
      if (error instanceof SpotifyMusicError && (error.code === 'network' || error.code === 'rate_limited')) throw error;
      window.sessionStorage.removeItem(TOKEN_KEY);
      if (error instanceof SpotifyMusicError && error.code === 'development_restricted') throw error;
      throw new SpotifyMusicError('Spotify authorization expired. Connect again.', 'expired');
    }
    return storeToken(payload, this.beatFitUserId, current).accessToken;
  }
}

function spotifyConfig() {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID?.trim();
  const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI?.trim()
    || (typeof window === 'undefined' ? '' : `${window.location.origin}/auth/spotify/callback`);
  if (!clientId || !redirectUri) {
    throw new SpotifyMusicError('Spotify is not configured for this BeatFit environment.', 'unavailable');
  }
  return { clientId, redirectUri };
}

async function tokenRequest(body: URLSearchParams): Promise<TokenPayload> {
  let response: Response;
  try {
    response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw new SpotifyMusicError('Could not reach Spotify. Check your connection and try again.', 'network');
  }
  if (response.status === 429) {
    const retryAfter = positiveInteger(response.headers.get('Retry-After'));
    throw new SpotifyMusicError(
      retryAfter ? `Spotify rate limit reached. Try again in ${retryAfter} seconds.` : 'Spotify rate limit reached. Try again shortly.',
      'rate_limited',
      retryAfter,
    );
  }
  if (response.status === 403) {
    throw new SpotifyMusicError(
      'Spotify denied authorization. Confirm this account is allowlisted in Development Mode.',
      'development_restricted',
    );
  }
  if (!response.ok) throw new SpotifyMusicError('Spotify rejected the authorization request.', 'expired');
  try {
    return await response.json() as TokenPayload;
  } catch {
    throw new SpotifyMusicError('Spotify returned an invalid token response.', 'invalid_response');
  }
}

function storeToken(payload: TokenPayload, beatFitUserId: string, previous?: StoredToken) {
  const accessToken = stringValue(payload.access_token);
  const refreshToken = stringValue(payload.refresh_token) || previous?.refreshToken || '';
  const expiresIn = numberValue(payload.expires_in);
  const scopes = typeof payload.scope === 'string'
    ? payload.scope.split(' ').filter(Boolean)
    : previous?.scopes ?? [];
  if (!accessToken || !refreshToken || !expiresIn) {
    throw new SpotifyMusicError('Spotify returned an incomplete token response.', 'invalid_response');
  }
  assertRequiredScopes(scopes);
  const token = { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000, scopes, beatFitUserId };
  window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

function readStoredToken(beatFitUserId: string): StoredToken | undefined {
  const raw = window.sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredToken>;
    if (
      typeof parsed.accessToken !== 'string'
      || typeof parsed.refreshToken !== 'string'
      || typeof parsed.expiresAt !== 'number'
      || typeof parsed.beatFitUserId !== 'string'
      || !Array.isArray(parsed.scopes)
      || !parsed.scopes.every((scope) => typeof scope === 'string')
    ) throw new Error('invalid token');
    if (parsed.beatFitUserId !== beatFitUserId) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      return undefined;
    }
    return parsed as StoredToken;
  } catch {
    window.sessionStorage.removeItem(TOKEN_KEY);
    return undefined;
  }
}

function assertRequiredScopes(scopes: string[]) {
  if (REQUIRED_SCOPES.some((scope) => !scopes.includes(scope))) {
    throw new SpotifyMusicError('Spotify playlist permission is missing. Disconnect and approve access again.', 'missing_permissions');
  }
}

function safeSpotifyApiUrl(value: string) {
  const url = new URL(value, SPOTIFY_API_ORIGIN);
  if (url.origin !== SPOTIFY_API_ORIGIN || !url.pathname.startsWith('/v1/')) {
    throw new SpotifyMusicError('Spotify returned an unsafe pagination link.', 'invalid_response');
  }
  return url;
}

function normalizePage<T>(payload: unknown, normalize: (item: unknown, index: number) => T): SpotifyPage<T> {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new SpotifyMusicError('Spotify returned invalid playlist metadata.', 'invalid_response');
  }
  const offset = numberValue(payload.offset);
  return {
    items: payload.items.map((item, index) => normalize(item, offset + index)),
    next: typeof payload.next === 'string' ? safeSpotifyApiUrl(payload.next).toString() : undefined,
  };
}

function normalizePlaylist(value: unknown): SpotifyPlaylist {
  const item = isRecord(value) ? value : {};
  const collection = isRecord(item.items) ? item.items : {};
  return {
    id: stringValue(item.id),
    name: stringValue(item.name) || 'Untitled playlist',
    artworkUrl: firstImage(item.images),
    trackCount: numberValue(collection.total) || 0,
    externalUrl: externalSpotifyUrl(item.external_urls),
  };
}

function normalizePlaylistItem(value: unknown, index: number): SpotifyTrack {
  const wrapper = isRecord(value) ? value : {};
  const itemValue = wrapper.item;
  const item = isRecord(itemValue) ? itemValue : {};
  const isLocal = wrapper.is_local === true || item.is_local === true;
  const isTrack = item.type === 'track';
  const catalogId = stringValue(item.id);
  const id = `${catalogId || stringValue(item.uri) || 'unavailable'}:${index}`;
  const duration = numberValue(item.duration_ms) || 0;
  const restrictions = isRecord(item.restrictions);
  const isPlayable = isTrack && !isLocal && Boolean(stringValue(item.id)) && duration > 0 && item.is_playable !== false && !restrictions;
  const artists = Array.isArray(item.artists)
    ? item.artists.filter(isRecord).map((artist) => stringValue(artist.name)).filter(Boolean)
    : [];
  const album = isRecord(item.album) ? item.album : {};
  return {
    id,
    title: stringValue(item.name) || (isLocal ? 'Local track' : 'Unavailable track'),
    artist: artists.join(', ') || 'Unknown artist',
    duration_ms: duration,
    artwork_url: firstImage(album.images),
    isPlayable,
    unavailableReason: isLocal ? 'local' : !isTrack && Object.keys(item).length > 0 ? 'not_track' : duration <= 0 ? 'missing_metadata' : !isPlayable ? 'unavailable' : undefined,
    externalUrl: externalSpotifyUrl(item.external_urls),
    provider_identifier: catalogId ? {
      provider: 'spotify',
      catalog_id: catalogId,
    } : undefined,
  };
}

function clearPendingAuthorization() {
  window.sessionStorage.removeItem(VERIFIER_KEY);
  window.sessionStorage.removeItem(STATE_KEY);
  window.sessionStorage.removeItem(PKCE_OWNER_KEY);
}

function randomUrlSafeString(length: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function spotifyErrorMessage(response: Response) {
  try {
    const payload = await response.json() as { error?: { message?: unknown } | string; error_description?: unknown };
    if (isRecord(payload.error) && typeof payload.error.message === 'string') return payload.error.message;
    if (typeof payload.error_description === 'string') return payload.error_description;
    return typeof payload.error === 'string' ? payload.error : '';
  } catch { return ''; }
}

function firstImage(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord).map((image) => stringValue(image.url)).find(Boolean);
}
function externalSpotifyUrl(value: unknown) { return isRecord(value) ? stringValue(value.spotify) || undefined : undefined; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function stringValue(value: unknown) { return typeof value === 'string' ? value : ''; }
function numberValue(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function positiveInteger(value: string | null) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; }

export const spotifyTestExports = { normalizePage, normalizePlaylist, normalizePlaylistItem, safeSpotifyApiUrl };
