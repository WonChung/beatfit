import { describe, expect, it } from 'vitest';
import { selectedTracksToSongs } from '../music-provider/types';
import { spotifyPlaylistFixture, spotifyTrackFixture } from './fixtures';
import { MockSpotifyMusicService } from './mock-adapter';

describe('mock Spotify adapter', () => {
  it('supports connect, playlist browsing, and disconnect without a Spotify account', async () => {
    const service = new MockSpotifyMusicService(
      [spotifyPlaylistFixture],
      { [spotifyPlaylistFixture.id]: [spotifyTrackFixture] },
    );
    await service.authorize();
    expect(await service.authorizationStatus()).toBe('authorized');
    expect((await service.listPlaylists()).items).toEqual([spotifyPlaylistFixture]);
    expect((await service.getPlaylistTracks(spotifyPlaylistFixture.id)).items).toEqual([spotifyTrackFixture]);
    await service.disconnect();
    expect(await service.authorizationStatus()).toBe('disconnected');
  });

  it('models authorization cancellation', async () => {
    const service = new MockSpotifyMusicService();
    expect(await service.completeAuthorization(new URLSearchParams('error=access_denied'))).toBe('cancelled');
  });

  it('converts only playable tracks with duration to BeatFit songs', () => {
    expect(selectedTracksToSongs([
      spotifyTrackFixture,
      { ...spotifyTrackFixture, id: 'local', isPlayable: false, unavailableReason: 'local' },
      { ...spotifyTrackFixture, id: 'missing-duration', duration_ms: 0 },
    ])).toEqual([{
      title: spotifyTrackFixture.title,
      artist: spotifyTrackFixture.artist,
      duration_ms: spotifyTrackFixture.duration_ms,
      artwork_url: spotifyTrackFixture.artwork_url,
      provider_identifier: spotifyTrackFixture.provider_identifier,
    }]);
  });
});
