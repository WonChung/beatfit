import type { Song } from '@/types/workout';
import { selectedTracksToSongs, type MusicProviderPage, type MusicProviderPlaylist, type MusicProviderService, type MusicProviderTrack } from '../music-provider/types';

export type AppleMusicAuthorizationStatus = 'not_determined' | 'authorized' | 'denied' | 'cancelled' | 'no_subscription' | 'expired' | 'unavailable';
export type AppleMusicPlaylist = MusicProviderPlaylist;
export type AppleMusicTrack = MusicProviderTrack;
export type AppleMusicPage<T> = MusicProviderPage<T>;

export type AppleMusicService = MusicProviderService<AppleMusicAuthorizationStatus, AppleMusicPlaylist, AppleMusicTrack>;

export class AppleMusicError extends Error {
  constructor(message: string, readonly code: 'permission_denied' | 'cancelled' | 'no_subscription' | 'expired' | 'network' | 'unavailable' | 'invalid_response') { super(message); this.name = 'AppleMusicError'; }
}

export function toBeatFitSongs(tracks: AppleMusicTrack[]): Song[] {
  return selectedTracksToSongs(tracks);
}
