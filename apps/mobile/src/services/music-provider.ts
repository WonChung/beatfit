export interface MusicProviderPage<Item> {
  items: Item[];
  next?: string;
}

export interface MusicProviderService<Status, Playlist, Track> {
  authorizationStatus(): Promise<Status>;
  authorize(): Promise<Status>;
  disconnect(): Promise<void>;
  listPlaylists(page?: string): Promise<MusicProviderPage<Playlist>>;
  getPlaylistTracks(id: string, page?: string): Promise<MusicProviderPage<Track>>;
}
