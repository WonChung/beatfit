export const playlistFixture = {
  items: [{ id: 'playlist-1', name: 'BeatFit Run', images: [{ url: 'https://i.scdn.co/playlist.jpg' }], items: { total: 4 }, external_urls: { spotify: 'https://open.spotify.com/playlist/playlist-1' } }],
  next: 'https://api.spotify.com/v1/me/playlists?offset=50&limit=50',
};

export const playlistItemsFixture = {
  items: [
    { is_local: false, item: { id: 'track-1', uri: 'spotify:track:track-1', type: 'track', name: 'Intervals', duration_ms: 180000, is_playable: true, artists: [{ name: 'Runner' }], album: { images: [{ url: 'https://i.scdn.co/track.jpg' }] }, external_urls: { spotify: 'https://open.spotify.com/track/track-1' } } },
    { is_local: true, item: { id: null, uri: 'spotify:local:Artist:Album:Local:120', type: 'track', name: 'Local', duration_ms: 120000, artists: [{ name: 'Artist' }], album: { images: [] }, is_local: true } },
    { is_local: false, item: null },
    { is_local: false, item: { id: 'episode-1', type: 'episode', name: 'Podcast', duration_ms: 600000 } },
  ],
  next: null,
};
