import type {
  SpotifyAuthorizationStatus,
  SpotifyMusicService,
  SpotifyPlaylist,
  SpotifyTrack,
} from './types';

export class MockSpotifyMusicService implements SpotifyMusicService {
  status: SpotifyAuthorizationStatus = 'disconnected';

  constructor(
    private playlists: SpotifyPlaylist[] = [],
    private tracks: Record<string, SpotifyTrack[]> = {},
  ) {}

  async authorizationStatus() { return this.status; }
  async authorize() { this.status = 'authorized'; }
  async completeAuthorization(search: URLSearchParams) {
    this.status = search.get('error') === 'access_denied' ? 'cancelled' : 'authorized';
    return this.status;
  }
  async disconnect() { this.status = 'disconnected'; }
  async listPlaylists() { return { items: this.playlists }; }
  async getPlaylistTracks(id: string) { return { items: this.tracks[id] ?? [] }; }
}
