import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/services/supabase';
import type { SpotifyMusicService } from './types';
import { SpotifyMusicError } from './types';
import { normalizePlaylists, normalizePlaylistTracks } from './normalizer';

const TOKEN_KEY = 'beatfit.spotify.tokens.v1';
const SCOPES = 'playlist-read-private playlist-read-collaborative';
const ACCOUNTS_URL = 'https://accounts.spotify.com';
const API_URL = 'https://api.spotify.com/v1';
interface Tokens { accessToken: string; refreshToken: string; expiresAt: number; scope: string; beatFitUserId: string; }

export class ExpoSpotifyMusicService implements SpotifyMusicService {
  async authorizationStatus() {
    const tokens = await readTokens();
    if (!tokens) return 'not_connected' as const;
    return hasRequiredScopes(tokens.scope) ? 'authorized' as const : 'missing_permissions' as const;
  }

  async authorize() {
    const { clientId, redirectUri } = configuration();
    const beatFitUserId = await currentBeatFitUserId();
    const verifier = `${Crypto.randomUUID().replaceAll('-', '')}${Crypto.randomUUID().replaceAll('-', '')}`;
    const state = Crypto.randomUUID();
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
    const challenge = digest.replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
    const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: challenge });
    const result = await WebBrowser.openAuthSessionAsync(`${ACCOUNTS_URL}/authorize?${params}`, redirectUri);
    if (result.type !== 'success' || !result.url) return 'cancelled' as const;
    const callback = new URL(result.url);
    if (callback.searchParams.get('state') !== state) throw new SpotifyMusicError('Spotify authorization state did not match.', 'cancelled');
    if (callback.searchParams.get('error') === 'access_denied') return 'cancelled' as const;
    if (callback.searchParams.has('error')) throw new SpotifyMusicError('Spotify authorization failed. Confirm this account is allowlisted in Development Mode.', 'development_restriction');
    const code = callback.searchParams.get('code');
    if (!code) throw new SpotifyMusicError('Spotify did not return an authorization code.', 'cancelled');
    if (await currentBeatFitUserId() !== beatFitUserId) {
      throw new SpotifyMusicError('The BeatFit user changed during Spotify authorization. Try again.', 'cancelled');
    }
    await this.exchangeCode(code, verifier, clientId, redirectUri, beatFitUserId);
    return 'authorized' as const;
  }

  async disconnect() { await SecureStore.deleteItemAsync(TOKEN_KEY); }
  async listPlaylists(page = `${API_URL}/me/playlists?limit=50`) { return normalizePlaylists(await this.request(page)); }
  async getPlaylistTracks(id: string, page = `${API_URL}/playlists/${encodeURIComponent(id)}/items?limit=50`) { return normalizePlaylistTracks(await this.request(page)); }

  private async exchangeCode(code: string, verifier: string, clientId: string, redirectUri: string, beatFitUserId: string) {
    let response: Response;
    try { response = await fetch(`${ACCOUNTS_URL}/api/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier }) }); }
    catch { throw new SpotifyMusicError('Could not reach Spotify.', 'network'); }
    if (response.status === 429) throw rateLimitError(response);
    if (response.status === 403) throw new SpotifyMusicError('Spotify denied authorization. Confirm this account is allowlisted in Development Mode.', 'development_restriction');
    if (!response.ok) throw new SpotifyMusicError('Spotify authorization could not be completed.', 'cancelled');
    const tokens = await saveTokenResponse(await tokenPayload(response), undefined, undefined, beatFitUserId);
    if (!hasRequiredScopes(tokens.scope)) {
      await this.disconnect();
      throw new SpotifyMusicError('Spotify playlist permissions are missing. Connect again and approve access.', 'missing_permissions');
    }
  }

  private async request(url: string, refreshed = false): Promise<unknown> {
    if (!url.startsWith(`${API_URL}/`)) throw new SpotifyMusicError('Invalid Spotify pagination URL.', 'invalid_response');
    const accessToken = await this.accessToken();
    let response: Response;
    try { response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } }); }
    catch { throw new SpotifyMusicError('Could not reach Spotify.', 'network'); }
    if (response.status === 401 && !refreshed) { await this.refresh(); return this.request(url, true); }
    if (response.status === 401) { await this.disconnect(); throw new SpotifyMusicError('Spotify authorization expired. Connect again.', 'expired'); }
    if (response.status === 403) throw new SpotifyMusicError('Spotify denied access. Check scopes, the dashboard development-user allowlist, and playlist ownership or collaboration.', 'development_restriction');
    if (response.status === 429) { const retry = Number(response.headers.get('Retry-After')) || undefined; throw new SpotifyMusicError(retry ? `Spotify rate limit reached. Try again in ${retry} seconds.` : 'Spotify rate limit reached. Try again shortly.', 'rate_limited', retry); }
    if (!response.ok) throw new SpotifyMusicError(`Spotify returned an error (${response.status}).`, response.status >= 500 ? 'network' : 'missing_permissions');
    try { return await response.json(); } catch { throw new SpotifyMusicError('Spotify returned invalid metadata.', 'invalid_response'); }
  }

  private async accessToken() {
    const tokens = await readTokens();
    if (!tokens) throw new SpotifyMusicError('Connect Spotify to continue.', 'expired');
    if (!hasRequiredScopes(tokens.scope)) throw new SpotifyMusicError('Spotify playlist permissions are missing. Connect again and approve access.', 'missing_permissions');
    if (tokens.expiresAt <= Date.now() + 30_000) return this.refresh();
    return tokens.accessToken;
  }

  private async refresh() {
    const tokens = await readTokens(); const { clientId } = configuration();
    if (!tokens?.refreshToken) { await this.disconnect(); throw new SpotifyMusicError('Spotify authorization expired. Connect again.', 'expired'); }
    let response: Response;
    try { response = await fetch(`${ACCOUNTS_URL}/api/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: tokens.refreshToken }) }); }
    catch { throw new SpotifyMusicError('Could not reach Spotify.', 'network'); }
    if (response.status === 429) throw rateLimitError(response);
    if (response.status === 403) { await this.disconnect(); throw new SpotifyMusicError('Spotify denied authorization. Confirm this account is allowlisted in Development Mode.', 'development_restriction'); }
    if (!response.ok) { await this.disconnect(); throw new SpotifyMusicError('Spotify authorization expired. Connect again.', 'expired'); }
    const refreshed = await saveTokenResponse(await tokenPayload(response), tokens.refreshToken, tokens.scope, tokens.beatFitUserId);
    if (!hasRequiredScopes(refreshed.scope)) throw new SpotifyMusicError('Spotify playlist permissions are missing. Connect again and approve access.', 'missing_permissions');
    return refreshed.accessToken;
  }
}

async function readTokens(): Promise<Tokens | null> { const stored = await SecureStore.getItemAsync(TOKEN_KEY); if (!stored) return null; try { const value = JSON.parse(stored) as Tokens; const valid = value.accessToken && value.refreshToken && value.expiresAt && typeof value.scope === 'string' && typeof value.beatFitUserId === 'string'; if (!valid || value.beatFitUserId !== await currentBeatFitUserId()) { await SecureStore.deleteItemAsync(TOKEN_KEY); return null; } return value; } catch { await SecureStore.deleteItemAsync(TOKEN_KEY); return null; } }
async function saveTokenResponse(payload: unknown, existingRefresh: string | undefined, existingScope: string | undefined, beatFitUserId: string): Promise<Tokens> { const value = payload as Record<string, unknown>; if (typeof value.access_token !== 'string' || typeof value.expires_in !== 'number' || (typeof value.refresh_token !== 'string' && !existingRefresh)) throw new SpotifyMusicError('Spotify returned invalid token data.', 'invalid_response'); const tokens = { accessToken: value.access_token, refreshToken: typeof value.refresh_token === 'string' ? value.refresh_token : existingRefresh!, expiresAt: Date.now() + value.expires_in * 1000, scope: typeof value.scope === 'string' ? value.scope : existingScope ?? '', beatFitUserId }; await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); return tokens; }
async function tokenPayload(response: Response) { try { return await response.json(); } catch { throw new SpotifyMusicError('Spotify returned invalid token data.', 'invalid_response'); } }
function hasRequiredScopes(scope: string) { const granted = new Set(scope.split(/\s+/).filter(Boolean)); return SCOPES.split(' ').every((required) => granted.has(required)); }
function rateLimitError(response: Response) { const retry = Number(response.headers.get('Retry-After')) || undefined; return new SpotifyMusicError(retry ? `Spotify rate limit reached. Try again in ${retry} seconds.` : 'Spotify rate limit reached. Try again shortly.', 'rate_limited', retry); }
async function currentBeatFitUserId() { const { data } = await supabase.auth.getSession(); const userId = data.session?.user.id; if (!userId) throw new SpotifyMusicError('Sign in to BeatFit before connecting Spotify.', 'expired'); return userId; }
function configuration() { const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID?.trim(); const redirectUri = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI?.trim(); if (!clientId || !redirectUri) throw new SpotifyMusicError('Spotify is not configured for this build.', 'configuration'); return { clientId, redirectUri }; }

export const spotifyMusicService = new ExpoSpotifyMusicService();
