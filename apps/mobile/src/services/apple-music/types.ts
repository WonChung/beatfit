import type { Song } from '@/types/workout';
import type { MusicProviderPage, MusicProviderService } from '@/services/music-provider';

export type AppleMusicAuthorizationStatus =
  | 'not_determined'
  | 'authorized'
  | 'denied'
  | 'restricted'
  | 'cancelled'
  | 'no_subscription'
  | 'expired'
  | 'unavailable';

export interface AppleMusicPlaylist {
  id: string;
  name: string;
  artworkUrl?: string;
  trackCount?: number;
}

export interface AppleMusicTrack extends Song {
  id: string;
  isPlayable: boolean;
}

export type AppleMusicPage<T> = MusicProviderPage<T>;

export interface AppleMusicCapabilities {
  personalizedLibrary: boolean;
  catalogMetadata: boolean;
  reason?: string;
}

export interface AppleMusicService extends MusicProviderService<AppleMusicAuthorizationStatus, AppleMusicPlaylist, AppleMusicTrack> {
  capabilities(): AppleMusicCapabilities;
}

export class AppleMusicError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'permission_denied'
      | 'cancelled'
      | 'no_subscription'
      | 'expired'
      | 'network'
      | 'unavailable'
      | 'invalid_response'
  ) {
    super(message);
    this.name = 'AppleMusicError';
  }
}

export function toBeatFitSongs(tracks: AppleMusicTrack[]): Song[] {
  return tracks
    .filter((track) => track.isPlayable && track.duration_ms > 0)
    .map(({ title, artist, duration_ms, artwork_url, provider_identifier }) => ({
      title: title || 'Unknown title', artist: artist || 'Unknown artist', duration_ms,
      artwork_url, provider_identifier,
    }));
}
