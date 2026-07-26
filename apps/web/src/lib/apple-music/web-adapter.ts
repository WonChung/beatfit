"use client";

import { getApiBaseUrl } from '../api-config';
import { createClient } from '../supabase/client';
import type { AppleMusicAuthorizationStatus, AppleMusicPage, AppleMusicPlaylist, AppleMusicService, AppleMusicTrack } from './types';
import { AppleMusicError } from './types';

const OWNER_KEY = 'beatfit.apple_music.owner';
const MUSIC_KIT_PATH_ORIGIN = 'https://music.apple.com';

interface MusicKitInstance {
  isAuthorized?: boolean;
  storefrontId?: string;
  authorize(): Promise<string>;
  unauthorize(): Promise<void> | void;
  api: { music(path: string): Promise<unknown> };
}
interface MusicKitGlobal {
  configure(options: { developerToken: string; app: { name: string; build: string } }): Promise<MusicKitInstance> | MusicKitInstance;
  getInstance(): MusicKitInstance;
}
declare global { interface Window { MusicKit?: MusicKitGlobal; } }

let scriptPromise: Promise<void> | undefined;

export class WebAppleMusicService implements AppleMusicService {
  private music?: MusicKitInstance;

  constructor(private readonly beatFitUserId: string) {
    if (!beatFitUserId.trim()) {
      throw new AppleMusicError('A BeatFit session is required to connect Apple Music.', 'unavailable');
    }
  }

  async authorizationStatus(): Promise<AppleMusicAuthorizationStatus> {
    const music = this.music ?? existingMusicKitInstance();
    if (!music) {
      if (readOwner() !== this.beatFitUserId) clearOwner();
      return 'not_determined';
    }
    this.music = music;
    if (!music.isAuthorized) {
      if (readOwner() === this.beatFitUserId) clearOwner();
      return 'not_determined';
    }
    if (readOwner() !== this.beatFitUserId) {
      await resetAuthorization(music).catch(() => undefined);
      return 'not_determined';
    }
    try {
      await currentBeatFitSession(this.beatFitUserId);
      return 'authorized';
    } catch {
      await resetAuthorization(music).catch(() => undefined);
      return 'expired';
    }
  }

  async authorize(): Promise<AppleMusicAuthorizationStatus> {
    let music: MusicKitInstance | undefined;
    try {
      music = await this.getConfiguredMusicKit();
      if (music.isAuthorized && readOwner() === this.beatFitUserId) {
        await currentBeatFitSession(this.beatFitUserId);
        return 'authorized';
      }
      if (readOwner() !== this.beatFitUserId) {
        if (music.isAuthorized) await resetAuthorization(music);
        else clearOwner();
      }
      await currentBeatFitSession(this.beatFitUserId);
      await music.authorize();
      await currentBeatFitSession(this.beatFitUserId);
      const ownerAfterAuthorization = readOwner();
      if (ownerAfterAuthorization && ownerAfterAuthorization !== this.beatFitUserId) {
        throw new AppleMusicError('Your BeatFit account changed while Apple Music was connecting.', 'expired');
      }
      if (music.isAuthorized === false) {
        clearOwner();
        return 'denied';
      }
      writeOwner(this.beatFitUserId);
      return 'authorized';
    } catch (error) {
      if (music) await resetAuthorization(music).catch(() => undefined);
      if (error instanceof AppleMusicError) throw error;
      const text = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (text.includes('cancel')) return 'cancelled';
      if (text.includes('subscription')) return 'no_subscription';
      throw new AppleMusicError('Apple Music authorization failed.', 'permission_denied');
    }
  }

  async disconnect() {
    const music = this.music ?? existingMusicKitInstance();
    if (music) this.music = music;
    await resetAuthorization(music);
  }

  async listPlaylists(page = '/v1/me/library/playlists?limit=25') {
    return normalizePage<AppleMusicPlaylist>(await this.authorizedRequest(page), normalizePlaylist);
  }

  async getPlaylistTracks(id: string, page?: string) {
    const path = page ?? `/v1/me/library/playlists/${encodeURIComponent(id)}/tracks?limit=25`;
    const storefront = this.music?.storefrontId ?? process.env.NEXT_PUBLIC_APPLE_MUSIC_DEFAULT_STOREFRONT ?? 'us';
    return normalizePage<AppleMusicTrack>(await this.authorizedRequest(path), (item) => normalizeTrack(item, storefront));
  }

  private async authorizedRequest(path: string) {
    const safePath = safeAppleMusicLibraryPath(path);
    const music = await this.getConfiguredMusicKit();
    await this.assertOwnedAuthorization(music);
    let payload: unknown;
    try {
      payload = await music.api.music(safePath);
    } catch {
      throw new AppleMusicError('Could not load your Apple Music library.', 'network');
    }
    await this.assertOwnedAuthorization(music);
    return payload;
  }

  private async assertOwnedAuthorization(music: MusicKitInstance) {
    if (readOwner() !== this.beatFitUserId) {
      await resetAuthorization(music).catch(() => undefined);
      throw new AppleMusicError('Apple Music belongs to another BeatFit session. Connect again.', 'expired');
    }
    try {
      await currentBeatFitSession(this.beatFitUserId);
    } catch (error) {
      await resetAuthorization(music).catch(() => undefined);
      throw error;
    }
    if (!music.isAuthorized) {
      clearOwner();
      throw new AppleMusicError('Apple Music authorization expired. Connect again.', 'expired');
    }
  }

  private async getConfiguredMusicKit() {
    if (this.music) return this.music;
    await loadMusicKit();
    const token = await getDeveloperToken(this.beatFitUserId);
    if (!window.MusicKit) throw new AppleMusicError('MusicKit did not load.', 'unavailable');
    this.music = await window.MusicKit.configure({ developerToken: token, app: { name: 'BeatFit', build: '1.0.0' } });
    return this.music;
  }
}

async function loadMusicKit() {
  if (window.MusicKit) return;
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
    script.async = true; script.onload = () => resolve(); script.onerror = () => reject(new AppleMusicError('Could not load MusicKit.', 'network'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function getDeveloperToken(beatFitUserId: string) {
  const session = await currentBeatFitSession(beatFitUserId);
  const response = await fetch(`${getApiBaseUrl()}/music/apple/developer-token`, { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new AppleMusicError('Apple Music is not configured.', 'unavailable');
  return ((await response.json()) as { token: string }).token;
}

async function currentBeatFitSession(beatFitUserId: string) {
  const { data, error } = await createClient().auth.getSession();
  if (error || data.session?.user.id !== beatFitUserId) {
    throw new AppleMusicError('Your BeatFit session changed or expired.', 'expired');
  }
  return data.session;
}

function existingMusicKitInstance() {
  try {
    return window.MusicKit?.getInstance();
  } catch {
    return undefined;
  }
}

async function resetAuthorization(music?: MusicKitInstance) {
  clearOwner();
  if (!music) return;
  try {
    await music.unauthorize();
  } catch {
    throw new AppleMusicError('Could not disconnect Apple Music completely. Try again.', 'network');
  } finally {
    clearOwner();
  }
}

function readOwner() {
  try {
    return window.sessionStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(beatFitUserId: string) {
  try {
    window.sessionStorage.setItem(OWNER_KEY, beatFitUserId);
    if (window.sessionStorage.getItem(OWNER_KEY) !== beatFitUserId) throw new Error('storage unavailable');
  } catch {
    throw new AppleMusicError('Apple Music cannot be connected because account-bound tab storage is unavailable.', 'unavailable');
  }
}

function clearOwner() {
  try {
    window.sessionStorage.removeItem(OWNER_KEY);
  } catch {
    // Failing closed: no library request trusts an unreadable owner marker.
  }
}

function safeAppleMusicLibraryPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new AppleMusicError('Apple Music returned an unsafe pagination link.', 'invalid_response');
  }
  let url: URL;
  try {
    url = new URL(value, MUSIC_KIT_PATH_ORIGIN);
  } catch {
    throw new AppleMusicError('Apple Music returned an unsafe pagination link.', 'invalid_response');
  }
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    throw new AppleMusicError('Apple Music returned an unsafe pagination link.', 'invalid_response');
  }
  if (
    url.origin !== MUSIC_KIT_PATH_ORIGIN
    || url.hash
    || (decodedPath !== '/v1/me/library' && !decodedPath.startsWith('/v1/me/library/'))
  ) {
    throw new AppleMusicError('Apple Music returned an unsafe pagination link.', 'invalid_response');
  }
  return `${url.pathname}${url.search}`;
}

function normalizePage<T>(payload: unknown, normalize: (item: Record<string, unknown>) => T): AppleMusicPage<T> {
  const root = payload as { data?: unknown[]; next?: unknown };
  if (!root || !Array.isArray(root.data)) throw new AppleMusicError('Apple Music returned invalid metadata.', 'invalid_response');
  return {
    items: root.data.filter(isRecord).map(normalize),
    next: typeof root.next === 'string' ? safeAppleMusicLibraryPath(root.next) : undefined,
  };
}
function normalizePlaylist(item: Record<string, unknown>): AppleMusicPlaylist {
  const attributes = isRecord(item.attributes) ? item.attributes : {};
  return { id: stringValue(item.id), name: stringValue(attributes.name, 'Untitled playlist'), artworkUrl: artwork(attributes.artwork), trackCount: numberValue(attributes.trackCount) };
}
function normalizeTrack(item: Record<string, unknown>, storefront: string): AppleMusicTrack {
  const attributes = isRecord(item.attributes) ? item.attributes : {};
  const playParams = isRecord(attributes.playParams) ? attributes.playParams : {};
  const id = stringValue(item.id);
  return { id, title: stringValue(attributes.name, 'Unknown title'), artist: stringValue(attributes.artistName, 'Unknown artist'), duration_ms: numberValue(attributes.durationInMillis) ?? 0, artwork_url: artwork(attributes.artwork), isPlayable: Object.keys(playParams).length > 0, provider_identifier: { provider: 'apple_music', catalog_id: stringValue(playParams.catalogId ?? playParams.id, id), library_id: id, storefront } };
}
function artwork(value: unknown) { if (!isRecord(value) || typeof value.url !== 'string') return undefined; return value.url.replace('{w}', '600').replace('{h}', '600'); }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function stringValue(value: unknown, fallback = '') { return typeof value === 'string' && value ? value : fallback; }
function numberValue(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }

export const appleMusicTestExports = {
  normalizePage,
  normalizePlaylist,
  ownerKey: OWNER_KEY,
  safeAppleMusicLibraryPath,
};
