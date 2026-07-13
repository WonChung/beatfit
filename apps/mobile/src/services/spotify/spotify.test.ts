import { describe, expect, it } from '@jest/globals';
import { playlistFixture, playlistItemsFixture } from './__fixtures__/provider-fixtures';
import { MockSpotifyMusicService } from './mock-adapter';
import { normalizePlaylists, normalizePlaylistTracks } from './normalizer';
import { toBeatFitSongs } from './types';

describe('Spotify metadata provider', () => {
  it('normalizes current playlist and item field names', () => {
    const playlists = normalizePlaylists(playlistFixture);
    const tracks = normalizePlaylistTracks(playlistItemsFixture);
    expect(playlists.items[0]).toMatchObject({ id: 'playlist-1', trackCount: 4 });
    expect(playlists.next).toContain('offset=50');
    expect(tracks.items).toHaveLength(3);
    expect(tracks.items[0]).toMatchObject({ id: 'track-1:0', selectable: true, duration_ms: 180000 });
    expect(tracks.items[1]).toMatchObject({ local: true, selectable: false });
    expect(tracks.items[2]).toMatchObject({ selectable: false });
  });

  it('connects and browses through a mocked service without Spotify', async () => {
    const tracks = normalizePlaylistTracks(playlistItemsFixture).items;
    const service = new MockSpotifyMusicService([{ id: 'playlist-1', name: 'Run' }], { 'playlist-1': tracks });
    expect(await service.authorize()).toBe('authorized');
    expect((await service.listPlaylists()).items).toHaveLength(1);
    expect(toBeatFitSongs((await service.getPlaylistTracks('playlist-1')).items)).toEqual([
      expect.objectContaining({ title: 'Intervals', provider_identifier: { provider: 'spotify', catalog_id: 'track-1' } }),
    ]);
    await service.disconnect();
    expect(await service.authorizationStatus()).toBe('not_connected');
  });
});
