import type { Song } from '@/types/workout';
import type { MusicProviderPage, MusicProviderService } from '@/services/music-provider';

export type SpotifyAuthorizationStatus = 'not_connected' | 'authorized' | 'cancelled' | 'expired' | 'missing_permissions';
export interface SpotifyPlaylist {
  id: string;
  name: string;
  artworkUrl?: string;
  trackCount?: number;
  externalUrl?: string;
}
export interface SpotifyTrack extends Song {
  id: string;
  selectable: boolean;
  local: boolean;
  unavailableReason?: string;
  externalUrl?: string;
}
export type SpotifyPage<T> = MusicProviderPage<T>;
export type SpotifyMusicService = MusicProviderService<SpotifyAuthorizationStatus, SpotifyPlaylist, SpotifyTrack>;

export type SpotifyErrorCode = 'cancelled' | 'expired' | 'missing_permissions' | 'development_restriction' | 'rate_limited' | 'network' | 'invalid_response' | 'configuration';
export class SpotifyMusicError extends Error {
  constructor(message: string, readonly code: SpotifyErrorCode, readonly retryAfterSeconds?: number) {
    super(message); this.name = 'SpotifyMusicError';
  }
}

export function toBeatFitSongs(tracks: SpotifyTrack[]): Song[] {
  return tracks.filter((track) => track.selectable && track.duration_ms > 0).map(
    ({ title, artist, duration_ms, artwork_url, provider_identifier }) => ({
      title: title || 'Unknown title', artist: artist || 'Unknown artist', duration_ms,
      artwork_url, provider_identifier,
    })
  );
}
