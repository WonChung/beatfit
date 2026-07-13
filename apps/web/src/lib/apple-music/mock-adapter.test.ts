import { describe, expect, it } from 'vitest';
import { MockAppleMusicService } from './mock-adapter';
import { toBeatFitSongs } from './types';

describe('mock Apple Music adapter', () => {
  it('supports authorization, metadata browsing, and disconnect', async () => {
    const track = { id: 't1', title: 'Song', artist: 'Artist', duration_ms: 120000, isPlayable: true, provider_identifier: { provider: 'apple_music' as const, catalog_id: 'c1', storefront: 'us' } };
    const service = new MockAppleMusicService([{ id: 'p1', name: 'Runs' }], { p1: [track] });
    expect(await service.authorize()).toBe('authorized');
    expect((await service.listPlaylists()).items).toHaveLength(1);
    expect((await service.getPlaylistTracks('p1')).items[0]).toEqual(track);
    await service.disconnect();
    expect(await service.authorizationStatus()).toBe('not_determined');
  });

  it('filters unavailable metadata when creating BeatFit songs', () => {
    const track = { id: 't1', title: 'Song', artist: 'Artist', duration_ms: 120000, isPlayable: true, provider_identifier: { provider: 'apple_music' as const, catalog_id: 'c1', storefront: 'us' } };
    expect(toBeatFitSongs([track, { ...track, id: 't2', duration_ms: 0 }])).toEqual([{
      title: 'Song', artist: 'Artist', duration_ms: 120000,
      artwork_url: undefined, provider_identifier: track.provider_identifier,
    }]);
  });
});
