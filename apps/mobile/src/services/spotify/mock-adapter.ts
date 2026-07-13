import type { SpotifyMusicService, SpotifyPlaylist, SpotifyTrack } from './types';
export class MockSpotifyMusicService implements SpotifyMusicService {
  connected = false;
  constructor(private playlists: SpotifyPlaylist[] = [], private tracks: Record<string, SpotifyTrack[]> = {}) {}
  async authorizationStatus() { return this.connected ? 'authorized' as const : 'not_connected' as const; }
  async authorize() { this.connected = true; return 'authorized' as const; }
  async disconnect() { this.connected = false; }
  async listPlaylists() { return { items: this.playlists }; }
  async getPlaylistTracks(id: string) { return { items: this.tracks[id] ?? [] }; }
}
