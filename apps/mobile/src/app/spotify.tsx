import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { spotifyMusicService, toBeatFitSongs, type SpotifyPlaylist, type SpotifyTrack } from '@/services/spotify';
import { useWorkoutStore } from '@/state/workout-store';

export default function SpotifyScreen() {
  const router = useRouter();
  const { selectedSongs, setSelectedSongs } = useWorkoutStore();
  const [connected, setConnected] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistNext, setPlaylistNext] = useState<string>();
  const [playlist, setPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [trackNext, setTrackNext] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void spotifyMusicService.authorizationStatus().then((status) => {
      setConnected(status === 'authorized');
      setLoading(false);
      if (status === 'authorized') void loadPlaylists();
      else if (status === 'missing_permissions') {
        setError('Spotify playlist permissions are missing. Connect again and approve access.');
      }
    }).catch((caught) => {
      setError(message(caught));
      setLoading(false);
    });
  }, []);

  async function connect() {
    setLoading(true);
    setError(null);
    try {
      const status = await spotifyMusicService.authorize();
      if (status === 'cancelled') {
        setError('Spotify authorization was cancelled.');
        return;
      }
      setConnected(true);
      await loadPlaylists();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    setError(null);
    try {
      await spotifyMusicService.disconnect();
      setConnected(false);
      setPlaylists([]);
      setPlaylist(null);
      setTracks([]);
      setSelected(new Set());
      setSelectedSongs(selectedSongs.filter(
        (song) => song.provider_identifier?.provider !== 'spotify'
      ));
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaylists(page?: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await spotifyMusicService.listPlaylists(page);
      setPlaylists((current) => page ? [...current, ...result.items] : result.items);
      setPlaylistNext(result.next);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }

  async function openPlaylist(value: SpotifyPlaylist) {
    setPlaylist(value);
    setTracks([]);
    setSelected(new Set());
    await loadTracks(value.id);
  }

  async function loadTracks(id: string, page?: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await spotifyMusicService.getPlaylistTracks(id, page);
      setTracks((current) => page ? [...current, ...result.items] : result.items);
      setTrackNext(result.next);
    } catch (caught) {
      setError(message(caught));
      setTrackNext(undefined);
    } finally {
      setLoading(false);
    }
  }

  async function openSpotify(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      setError('Spotify could not be opened on this device.');
    }
  }

  function useTracks() {
    setSelectedSongs(toBeatFitSongs(tracks.filter((track) => selected.has(track.id))));
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">Spotify library</ThemedText>
          <ThemedText themeColor="textSecondary">
            Metadata and workout generation only. Spotify playback is not enabled.
          </ThemedText>
          {error ? <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
          {loading ? <ActivityIndicator accessibilityLabel="Loading Spotify" /> : null}
          {!connected ? (
            <Action label="Connect Spotify" disabled={loading} onPress={connect} />
          ) : (
            <Action label="Disconnect Spotify" disabled={loading} onPress={disconnect} />
          )}

          {connected && !playlist ? (
            <>
              <ThemedText type="smallBold">Playlists</ThemedText>
              {playlists.length === 0 && !loading ? (
                <ThemedText themeColor="textSecondary">Your Spotify library has no playlists.</ThemedText>
              ) : null}
              {playlists.map((item) => (
                <View key={item.id}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void openPlaylist(item)}
                    style={styles.row}>
                    {item.artworkUrl ? (
                      <Image source={{ uri: item.artworkUrl }} resizeMode="contain" style={styles.artwork} />
                    ) : <View style={styles.artwork} />}
                    <View style={styles.copy}>
                      <ThemedText type="smallBold">{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.trackCount ?? 'Unknown'} items
                      </ThemedText>
                    </View>
                  </Pressable>
                  {item.externalUrl ? (
                    <SpotifyLink onPress={() => void openSpotify(item.externalUrl!)} />
                  ) : null}
                </View>
              ))}
              {playlistNext ? (
                <Action label="Load more playlists" disabled={loading} onPress={() => void loadPlaylists(playlistNext)} />
              ) : null}
            </>
          ) : null}

          {playlist ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => { setPlaylist(null); setTracks([]); setError(null); }}
                style={styles.back}>
                <ThemedText type="smallBold">‹ All playlists</ThemedText>
              </Pressable>
              <ThemedText type="smallBold">{playlist.name}</ThemedText>
              {playlist.externalUrl ? (
                <SpotifyLink onPress={() => void openSpotify(playlist.externalUrl!)} />
              ) : null}
              {tracks.length === 0 && !loading && !error ? (
                <ThemedText themeColor="textSecondary">This playlist is empty.</ThemedText>
              ) : null}
              {tracks.map((track) => {
                const checked = selected.has(track.id);
                return (
                  <View key={track.id}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked, disabled: !track.selectable }}
                      disabled={!track.selectable}
                      onPress={() => setSelected((current) => toggle(current, track.id))}
                      style={[styles.row, !track.selectable && styles.disabled]}>
                      {track.artwork_url ? (
                        <Image source={{ uri: track.artwork_url }} resizeMode="contain" style={styles.artwork} />
                      ) : <View style={styles.artwork} />}
                      <View style={styles.copy}>
                        <ThemedText type="smallBold">{track.title}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {track.artist} · {track.duration_ms > 0
                            ? `${Math.round(track.duration_ms / 1000)} sec`
                            : 'Duration unavailable'}
                        </ThemedText>
                        {track.unavailableReason ? (
                          <ThemedText type="small" style={styles.error}>{track.unavailableReason}</ThemedText>
                        ) : null}
                      </View>
                      <ThemedText>{checked ? '✓' : '○'}</ThemedText>
                    </Pressable>
                    {track.externalUrl ? (
                      <SpotifyLink onPress={() => void openSpotify(track.externalUrl!)} />
                    ) : null}
                  </View>
                );
              })}
              {trackNext ? (
                <Action label="Load more tracks" disabled={loading} onPress={() => void loadTracks(playlist.id, trackNext)} />
              ) : null}
              <Action
                label={`Continue to Generate Workout (${selected.size})`}
                disabled={selected.size === 0}
                onPress={useTracks}
              />
            </>
          ) : null}

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open Spotify"
            onPress={() => void openSpotify('https://open.spotify.com')}
            style={styles.attribution}>
            <ExpoImage
              source={require('@/assets/images/spotify-full-logo-black.svg')}
              contentFit="contain"
              style={styles.spotifyLogo}
            />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Action({ label, onPress, disabled = false }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.action}>
      <ThemedText style={styles.actionText}>{label}</ThemedText>
    </Pressable>
  );
}

function SpotifyLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.spotifyLink}>
      <ThemedText type="smallBold" style={styles.spotifyLinkText}>OPEN SPOTIFY</ThemedText>
    </Pressable>
  );
}

function toggle(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}
function message(error: unknown) {
  return error instanceof Error ? error.message : 'Spotify is unavailable.';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  artwork: {
    width: 52,
    height: 52,
    borderRadius: 4,
    backgroundColor: '#d8d8dc',
  },
  copy: { flex: 1, gap: Spacing.one },
  action: {
    minHeight: 52,
    backgroundColor: '#1db954',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  actionText: { color: '#fff', fontWeight: '800' },
  error: { color: '#dc2626' },
  disabled: { opacity: 0.45 },
  back: { minHeight: 44, justifyContent: 'center' },
  spotifyLink: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginLeft: 68,
  },
  spotifyLinkText: { color: '#16833b' },
  attribution: {
    minHeight: 52,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  spotifyLogo: { width: 100, height: 28 },
});
