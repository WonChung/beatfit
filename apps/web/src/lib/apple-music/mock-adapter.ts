import type { AppleMusicPlaylist, AppleMusicService, AppleMusicTrack } from './types';
export class MockAppleMusicService implements AppleMusicService {
  connected = false;
  constructor(private playlists: AppleMusicPlaylist[] = [], private tracks: Record<string, AppleMusicTrack[]> = {}) {}
  async authorizationStatus() { return this.connected ? 'authorized' as const : 'not_determined' as const; }
  async authorize() { this.connected = true; return 'authorized' as const; }
  async disconnect() { this.connected = false; }
  async listPlaylists() { return { items: this.playlists }; }
  async getPlaylistTracks(id: string) { return { items: this.tracks[id] ?? [] }; }
}
