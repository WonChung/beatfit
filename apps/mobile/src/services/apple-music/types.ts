import type { Song } from '@/types/workout';

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

export interface AppleMusicPage<T> {
  items: T[];
  next?: string;
}

export interface AppleMusicCapabilities {
  personalizedLibrary: boolean;
  catalogMetadata: boolean;
  reason?: string;
}

export interface AppleMusicService {
  capabilities(): AppleMusicCapabilities;
  authorizationStatus(): Promise<AppleMusicAuthorizationStatus>;
  authorize(): Promise<AppleMusicAuthorizationStatus>;
  disconnect(): Promise<void>;
  listPlaylists(page?: string): Promise<AppleMusicPage<AppleMusicPlaylist>>;
  getPlaylistTracks(id: string, page?: string): Promise<AppleMusicPage<AppleMusicTrack>>;
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
