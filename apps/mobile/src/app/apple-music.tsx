import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { appleMusicService, toBeatFitSongs, type AppleMusicPlaylist, type AppleMusicTrack } from '@/services/apple-music';
import { useWorkoutStore } from '@/state/workout-store';

export default function AppleMusicScreen() {
  const router = useRouter();
  const { setSelectedSongs } = useWorkoutStore();
  const [status, setStatus] = useState<string>('loading');
  const [playlists, setPlaylists] = useState<AppleMusicPlaylist[]>([]);
  const [playlist, setPlaylist] = useState<AppleMusicPlaylist | null>(null);
  const [tracks, setTracks] = useState<AppleMusicTrack[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const capabilities = useMemo(() => appleMusicService.capabilities(), []);

  useEffect(() => { void appleMusicService.authorizationStatus().then(setStatus); }, []);

  async function connect() {
    setLoading(true); setError(null);
    try {
      const nextStatus = await appleMusicService.authorize();
      setStatus(nextStatus);
      if (nextStatus === 'authorized') {
        const result = await appleMusicService.listPlaylists();
        setPlaylists(result.items);
      } else setError(statusMessage(nextStatus));
    } catch (caught) { setError(toMessage(caught)); } finally { setLoading(false); }
  }

  async function disconnect() {
    setLoading(true); setError(null);
    try { await appleMusicService.disconnect(); setStatus('not_determined'); setPlaylists([]); setPlaylist(null); setTracks([]); setSelected(new Set()); }
    catch (caught) { setError(toMessage(caught)); } finally { setLoading(false); }
  }

  async function openPlaylist(next: AppleMusicPlaylist) {
    setLoading(true); setError(null); setPlaylist(next); setSelected(new Set());
    try { setTracks((await appleMusicService.getPlaylistTracks(next.id)).items); }
    catch (caught) { setError(toMessage(caught)); setTracks([]); } finally { setLoading(false); }
  }

  function useTracks() {
    setSelectedSongs(toBeatFitSongs(tracks.filter((track) => selected.has(track.id))));
    router.back();
  }

  return (
    <ThemedView style={styles.container}><SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle">Apple Music library</ThemedText>
        {!capabilities.personalizedLibrary ? <ThemedText themeColor="textSecondary">{capabilities.reason}</ThemedText> : null}
        {error ? <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
        {loading || status === 'loading' ? <ActivityIndicator accessibilityLabel="Loading Apple Music" /> : null}
        {status !== 'authorized' ? <Action label="Connect Apple Music" disabled={loading || !capabilities.personalizedLibrary} onPress={connect} /> : <Action label="Disconnect" disabled={loading} onPress={disconnect} />}

        {status === 'authorized' && !playlist ? <>
          <ThemedText type="smallBold">Playlists</ThemedText>
          {playlists.length === 0 && !loading ? <ThemedText themeColor="textSecondary">Your Apple Music library has no playlists.</ThemedText> : null}
          {playlists.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => openPlaylist(item)} style={styles.row}>
            {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={styles.artwork} /> : <View style={styles.artwork} />}
            <View style={styles.copy}><ThemedText type="smallBold">{item.name || 'Untitled playlist'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{item.trackCount ?? 'Unknown'} tracks</ThemedText></View>
          </Pressable>)}
        </> : null}

        {playlist ? <>
          <Pressable accessibilityRole="button" onPress={() => { setPlaylist(null); setTracks([]); }} style={styles.back}><ThemedText type="smallBold">‹ All playlists</ThemedText></Pressable>
          <ThemedText type="smallBold">{playlist.name}</ThemedText>
          {tracks.length === 0 && !loading ? <ThemedText themeColor="textSecondary">This playlist has no available tracks.</ThemedText> : null}
          {tracks.map((track) => {
            const usable = track.isPlayable && track.duration_ms > 0;
            const checked = selected.has(track.id);
            return <Pressable key={track.id} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !usable }} disabled={!usable} onPress={() => setSelected((current) => { const next = new Set(current); if (next.has(track.id)) next.delete(track.id); else next.add(track.id); return next; })} style={[styles.row, !usable && styles.disabled]}>
              {track.artwork_url ? <Image source={{ uri: track.artwork_url }} style={styles.artwork} /> : <View style={styles.artwork} />}
              <View style={styles.copy}><ThemedText type="smallBold">{track.title || 'Unknown title'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{track.artist || 'Unknown artist'} · {track.duration_ms > 0 ? Math.round(track.duration_ms / 1000) + ' sec' : 'Duration unavailable'}</ThemedText></View>
              <ThemedText>{checked ? '✓' : '○'}</ThemedText>
            </Pressable>;
          })}
          <Action label={`Use ${selected.size} selected track${selected.size === 1 ? '' : 's'}`} disabled={selected.size === 0} onPress={useTracks} />
        </> : null}
      </ScrollView>
    </SafeAreaView></ThemedView>
  );
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={styles.action}><ThemedText style={styles.actionText}>{label}</ThemedText></Pressable>;
}
function toMessage(error: unknown) { return error instanceof Error ? error.message : 'Apple Music is unavailable.'; }
function statusMessage(status: string) { return ({ denied: 'Apple Music permission was denied.', cancelled: 'Apple Music authorization was cancelled.', no_subscription: 'An active Apple Music subscription is required.', expired: 'Apple Music authorization expired. Connect again.', restricted: 'Apple Music access is restricted on this device.' } as Record<string, string>)[status] ?? 'Apple Music could not be connected.'; }

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: Spacing.three, gap: Spacing.three },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  artwork: { width: 52, height: 52, borderRadius: Spacing.two, backgroundColor: '#d8d8dc' }, copy: { flex: 1, gap: Spacing.one },
  action: { minHeight: 52, backgroundColor: '#fa243c', borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.three },
  actionText: { color: '#fff', fontWeight: '800' }, error: { color: '#dc2626' }, disabled: { opacity: 0.45 }, back: { minHeight: 44, justifyContent: 'center' },
});
