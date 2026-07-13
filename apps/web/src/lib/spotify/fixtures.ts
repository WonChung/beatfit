import type { SpotifyPlaylist, SpotifyTrack } from './types';

export const spotifyPlaylistFixture: SpotifyPlaylist = {
  id: 'playlist-1',
  name: 'Morning Run',
  artworkUrl: 'https://i.scdn.co/image/playlist',
  trackCount: 4,
  externalUrl: 'https://open.spotify.com/playlist/playlist-1',
};

export const spotifyTrackFixture: SpotifyTrack = {
  id: 'track-1',
  title: 'Fast Song',
  artist: 'Test Artist',
  duration_ms: 225000,
  artwork_url: 'https://i.scdn.co/image/album',
  isPlayable: true,
  externalUrl: 'https://open.spotify.com/track/track-1',
  provider_identifier: {
    provider: 'spotify',
    catalog_id: 'track-1',
  },
};

export const spotifyApiPlaylistPageFixture = {
  items: [{
    id: 'playlist-1',
    name: 'Morning Run',
    images: [{ url: 'https://i.scdn.co/image/playlist' }],
    items: { total: 4 },
    external_urls: { spotify: 'https://open.spotify.com/playlist/playlist-1' },
  }],
  next: 'https://api.spotify.com/v1/me/playlists?limit=50&offset=50',
};

export const spotifyApiTrackPageFixture = {
  items: [
    {
      is_local: false,
      item: {
        id: 'track-1', type: 'track', name: 'Fast Song', duration_ms: 225000, is_playable: true,
        uri: 'spotify:track:track-1', artists: [{ name: 'Test Artist' }],
        album: { images: [{ url: 'https://i.scdn.co/image/album' }] },
        external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
      },
    },
    {
      is_local: true,
      item: { id: null, type: 'track', name: 'Local Demo', duration_ms: 90000, artists: [{ name: 'Local Artist' }] },
    },
    { item: null },
    { item: { id: 'episode-1', type: 'episode', name: 'Podcast', duration_ms: 120000 } },
  ],
  next: null,
};
