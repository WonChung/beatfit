import type { Song } from '@/types/workout';

export interface MusicProviderPlaylist {
  id: string;
  name: string;
  artworkUrl?: string;
  trackCount?: number;
  externalUrl?: string;
}

export interface MusicProviderTrack extends Song {
  id: string;
  isPlayable: boolean;
  unavailableReason?: 'local' | 'unavailable' | 'not_track' | 'missing_metadata';
  externalUrl?: string;
}

export interface MusicProviderPage<T> {
  items: T[];
  next?: string;
}

export interface MusicProviderService<
  Status,
  Playlist extends MusicProviderPlaylist,
  Track extends MusicProviderTrack,
  AuthorizationResult = Status,
> {
  authorizationStatus(): Promise<Status>;
  authorize(): Promise<AuthorizationResult>;
  disconnect(): Promise<void>;
  listPlaylists(page?: string): Promise<MusicProviderPage<Playlist>>;
  getPlaylistTracks(id: string, page?: string): Promise<MusicProviderPage<Track>>;
}

export function selectedTracksToSongs(tracks: MusicProviderTrack[]): Song[] {
  return tracks
    .filter((track) => track.isPlayable && track.duration_ms > 0)
    .map(({ title, artist, duration_ms, artwork_url, provider_identifier }) => ({
      title: title || 'Unknown title',
      artist: artist || 'Unknown artist',
      duration_ms,
      artwork_url,
      provider_identifier,
    }));
}
