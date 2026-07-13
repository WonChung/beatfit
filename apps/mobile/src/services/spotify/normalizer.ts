import type { SpotifyPage, SpotifyPlaylist, SpotifyTrack } from './types';
import { SpotifyMusicError } from './types';

export function normalizePlaylists(payload: unknown): SpotifyPage<SpotifyPlaylist> {
  const root = record(payload);
  if (!root || !Array.isArray(root.items)) throw invalid();
  return {
    items: root.items.flatMap<SpotifyPlaylist>((value) => {
      const item = record(value); if (!item || typeof item.id !== 'string') return [];
      const images = Array.isArray(item.images) ? item.images : [];
      const firstImage = record(images[0]);
      const contents = record(item.items);
      const externalUrls = record(item.external_urls);
      return [{ id: item.id, name: text(item.name, 'Untitled playlist'), artworkUrl: text(firstImage?.url) || undefined, trackCount: number(contents?.total), externalUrl: text(externalUrls?.spotify) || undefined }];
    }),
    next: safeNext(root.next),
  };
}

export function normalizePlaylistTracks(payload: unknown): SpotifyPage<SpotifyTrack> {
  const root = record(payload);
  if (!root || !Array.isArray(root.items)) throw invalid();
  const offset = number(root.offset) ?? 0;
  return {
    items: root.items.flatMap<SpotifyTrack>((value, index): SpotifyTrack[] => {
      const wrapper = record(value); if (!wrapper) return [];
      const item = record(wrapper.item);
      const occurrence = offset + index;
      if (!item) return [{ ...unavailable(`missing-${occurrence}`, 'This track is no longer available.'), local: false }];
      if (item.type !== 'track') return [];
      const local = wrapper.is_local === true || item.is_local === true;
      const album = record(item.album); const images = Array.isArray(album?.images) ? album.images : [];
      const image = record(images[0]); const artists = Array.isArray(item.artists) ? item.artists : [];
      const artist = artists.map((entry) => text(record(entry)?.name)).filter(Boolean).join(', ') || 'Unknown artist';
      const duration = number(item.duration_ms) ?? 0; const catalogId = text(item.id); const id = `${catalogId || text(item.uri) || 'local'}:${occurrence}`;
      const restrictions = record(item.restrictions); const explicitlyUnavailable = item.is_playable === false;
      const selectable = !local && !restrictions && !explicitlyUnavailable && duration > 0 && Boolean(text(item.id));
      const reason = local ? 'Local Spotify tracks cannot be selected.' : restrictions ? `Spotify restricted this track${text(restrictions.reason) ? ` (${text(restrictions.reason)})` : ''}.` : explicitlyUnavailable ? 'This track is unavailable in your market.' : duration <= 0 ? 'Track duration is unavailable.' : !text(item.id) ? 'Spotify did not provide a track identifier.' : undefined;
      const externalUrls = record(item.external_urls);
      return [{ id, title: text(item.name, 'Unknown title'), artist, duration_ms: duration, artwork_url: text(image?.url) || undefined, selectable, local, unavailableReason: reason, externalUrl: text(externalUrls?.spotify) || undefined, provider_identifier: { provider: 'spotify' as const, catalog_id: catalogId || id } }];
    }),
    next: safeNext(root.next),
  };
}

function unavailable(id: string, reason: string): SpotifyTrack { return { id, title: 'Unavailable track', artist: 'Spotify', duration_ms: 0, selectable: false, local: false, unavailableReason: reason, provider_identifier: { provider: 'spotify', catalog_id: id } }; }
function safeNext(value: unknown) { return typeof value === 'string' && value.startsWith('https://api.spotify.com/v1/') ? value : undefined; }
function record(value: unknown): Record<string, unknown> | undefined { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function text(value: unknown, fallback = '') { return typeof value === 'string' && value ? value : fallback; }
function number(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function invalid() { return new SpotifyMusicError('Spotify returned invalid metadata.', 'invalid_response'); }
