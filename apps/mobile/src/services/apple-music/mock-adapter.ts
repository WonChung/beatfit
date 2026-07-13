import type { AppleMusicPlaylist, AppleMusicService, AppleMusicTrack } from './types';

export class MockAppleMusicService implements AppleMusicService {
  connected = false;
  constructor(
    private readonly playlists: AppleMusicPlaylist[] = [],
    private readonly tracks: Record<string, AppleMusicTrack[]> = {}
  ) {}
  capabilities() { return { personalizedLibrary: true, catalogMetadata: true }; }
  async authorizationStatus() { return this.connected ? 'authorized' as const : 'not_determined' as const; }
  async authorize() { this.connected = true; return 'authorized' as const; }
  async disconnect() { this.connected = false; }
  async listPlaylists() { return { items: this.playlists }; }
  async getPlaylistTracks(id: string) { return { items: this.tracks[id] ?? [] }; }
}
