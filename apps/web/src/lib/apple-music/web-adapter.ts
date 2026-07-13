"use client";

import { API_BASE_URL } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import type { AppleMusicAuthorizationStatus, AppleMusicPage, AppleMusicPlaylist, AppleMusicService, AppleMusicTrack } from './types';
import { AppleMusicError } from './types';

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

  async authorizationStatus(): Promise<AppleMusicAuthorizationStatus> {
    if (!this.music) return 'not_determined';
    return this.music.isAuthorized ? 'authorized' : 'not_determined';
  }

  async authorize(): Promise<AppleMusicAuthorizationStatus> {
    try {
      const music = await this.getConfiguredMusicKit();
      await music.authorize();
      return music.isAuthorized === false ? 'denied' : 'authorized';
    } catch (error) {
      const text = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (text.includes('cancel')) return 'cancelled';
      if (text.includes('subscription')) return 'no_subscription';
      throw new AppleMusicError('Apple Music authorization failed.', 'permission_denied');
    }
  }

  async disconnect() { if (this.music) await this.music.unauthorize(); }

  async listPlaylists(page = '/v1/me/library/playlists?limit=25') {
    return normalizePage<AppleMusicPlaylist>(await this.authorizedRequest(page), normalizePlaylist);
  }

  async getPlaylistTracks(id: string, page?: string) {
    const path = page ?? `/v1/me/library/playlists/${encodeURIComponent(id)}/tracks?limit=25`;
    const storefront = this.music?.storefrontId ?? process.env.NEXT_PUBLIC_APPLE_MUSIC_DEFAULT_STOREFRONT ?? 'us';
    return normalizePage<AppleMusicTrack>(await this.authorizedRequest(path), (item) => normalizeTrack(item, storefront));
  }

  private async authorizedRequest(path: string) {
    const music = await this.getConfiguredMusicKit();
    if (!music.isAuthorized) throw new AppleMusicError('Apple Music authorization expired. Connect again.', 'expired');
    try { return await music.api.music(path); }
    catch { throw new AppleMusicError('Could not load your Apple Music library.', 'network'); }
  }

  private async getConfiguredMusicKit() {
    if (this.music) return this.music;
    await loadMusicKit();
    const token = await getDeveloperToken();
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

async function getDeveloperToken() {
  const { data } = await createClient().auth.getSession();
  if (!data.session) throw new AppleMusicError('Your BeatFit session expired.', 'expired');
  const response = await fetch(`${API_BASE_URL}/music/apple/developer-token`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
  if (!response.ok) throw new AppleMusicError('Apple Music is not configured.', 'unavailable');
  return ((await response.json()) as { token: string }).token;
}

function normalizePage<T>(payload: unknown, normalize: (item: Record<string, unknown>) => T): AppleMusicPage<T> {
  const root = payload as { data?: unknown[]; next?: unknown };
  if (!root || !Array.isArray(root.data)) throw new AppleMusicError('Apple Music returned invalid metadata.', 'invalid_response');
  return { items: root.data.filter(isRecord).map(normalize), next: typeof root.next === 'string' ? root.next : undefined };
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
