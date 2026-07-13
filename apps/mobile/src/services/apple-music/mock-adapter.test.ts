import { describe, expect, it } from '@jest/globals';
import { MockAppleMusicService } from './mock-adapter';
import { toBeatFitSongs } from './types';

const track = {
  id: 'track-1', title: 'Run', artist: 'Artist', duration_ms: 180000,
  artwork_url: 'https://example.test/art.jpg', isPlayable: true,
  provider_identifier: { provider: 'apple_music' as const, catalog_id: '1', storefront: 'us' },
};

describe('MockAppleMusicService', () => {
  it('connects, browses playlists, and disconnects without a real Apple account', async () => {
    const service = new MockAppleMusicService([{ id: 'p1', name: 'Workout' }], { p1: [track] });
    expect(await service.authorizationStatus()).toBe('not_determined');
    expect(await service.authorize()).toBe('authorized');
    expect((await service.listPlaylists()).items[0].name).toBe('Workout');
    expect((await service.getPlaylistTracks('p1')).items).toEqual([track]);
    await service.disconnect();
    expect(await service.authorizationStatus()).toBe('not_determined');
  });

  it('maps only usable tracks into BeatFit songs with provider metadata', () => {
    const unavailable = { ...track, id: 'track-2', duration_ms: 0, isPlayable: false };
    expect(toBeatFitSongs([track, unavailable])).toEqual([{
      title: track.title, artist: track.artist, duration_ms: track.duration_ms,
      artwork_url: track.artwork_url, provider_identifier: track.provider_identifier,
    }]);
  });
});
