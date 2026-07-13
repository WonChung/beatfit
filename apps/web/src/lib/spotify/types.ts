import type {
  MusicProviderPage,
  MusicProviderPlaylist,
  MusicProviderService,
  MusicProviderTrack,
} from '@/lib/music-provider/types';

export type SpotifyAuthorizationStatus =
  | 'disconnected'
  | 'authorized'
  | 'cancelled'
  | 'expired'
  | 'missing_permissions'
  | 'unavailable';

export type SpotifyPlaylist = MusicProviderPlaylist;
export type SpotifyTrack = MusicProviderTrack;
export type SpotifyPage<T> = MusicProviderPage<T>;

export interface SpotifyMusicService extends MusicProviderService<SpotifyAuthorizationStatus, SpotifyPlaylist, SpotifyTrack, void> {
  completeAuthorization(search: URLSearchParams): Promise<SpotifyAuthorizationStatus>;
}

export type SpotifyErrorCode =
  | 'cancelled'
  | 'expired'
  | 'invalid_state'
  | 'missing_permissions'
  | 'development_restricted'
  | 'playlist_restricted'
  | 'rate_limited'
  | 'network'
  | 'unavailable'
  | 'invalid_response';

export class SpotifyMusicError extends Error {
  constructor(
    message: string,
    readonly code: SpotifyErrorCode,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'SpotifyMusicError';
  }
}
