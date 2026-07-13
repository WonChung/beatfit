"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { selectedTracksToSongs } from '@/lib/music-provider/types';
import type { SpotifyPlaylist, SpotifyTrack } from '@/lib/spotify/types';
import { WebSpotifyMusicService } from '@/lib/spotify/web-adapter';
import type { Song } from '@/types/workout';

export default function SpotifyMusicBrowser({ beatFitUserId, onSelect }: { beatFitUserId: string; onSelect: (songs: Song[]) => void }) {
  const service = useMemo(() => new WebSpotifyMusicService(beatFitUserId), [beatFitUserId]);
  const [connected, setConnected] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlist, setPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nextPlaylists, setNextPlaylists] = useState<string>();
  const [nextTracks, setNextTracks] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const authorizationWasCancelled = new URLSearchParams(window.location.search).get('spotify') === 'cancelled';
    void service.authorizationStatus().then(async (status) => {
      if (!active || status !== 'authorized') {
        if (active && authorizationWasCancelled) setError('Spotify authorization was cancelled.');
        else if (active && (status === 'expired' || status === 'missing_permissions')) setError(statusMessage(status));
        return;
      }
      setConnected(true);
      setLoading(true);
      try {
        const page = await service.listPlaylists();
        if (active) { setPlaylists(page.items); setNextPlaylists(page.next); }
      } catch (caught) { if (active) setError(message(caught)); }
      finally { if (active) setLoading(false); }
    }).catch((caught) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [service]);

  async function connect() {
    setLoading(true); setError(null);
    try { await service.authorize(); }
    catch (caught) { setLoading(false); setError(message(caught)); }
  }

  async function disconnect() {
    setLoading(true); setError(null);
    try {
      await service.disconnect();
      setConnected(false); setPlaylists([]); setPlaylist(null); setTracks([]); setSelected(new Set());
      setNextPlaylists(undefined); setNextTracks(undefined); onSelect([]);
    } catch (caught) { setError(message(caught)); }
    finally { setLoading(false); }
  }

  async function openPlaylist(item: SpotifyPlaylist) {
    setLoading(true); setError(null); setPlaylist(item); setTracks([]); setSelected(new Set()); setNextTracks(undefined);
    try {
      const page = await service.getPlaylistTracks(item.id);
      setTracks(page.items); setNextTracks(page.next);
    } catch (caught) { setError(message(caught)); }
    finally { setLoading(false); }
  }

  async function loadMorePlaylists() {
    if (!nextPlaylists || loading) return;
    setLoading(true); setError(null);
    try {
      const page = await service.listPlaylists(nextPlaylists);
      setPlaylists((current) => appendUnique(current, page.items)); setNextPlaylists(page.next);
    } catch (caught) { setError(message(caught)); }
    finally { setLoading(false); }
  }

  async function loadMoreTracks() {
    if (!playlist || !nextTracks || loading) return;
    setLoading(true); setError(null);
    try {
      const page = await service.getPlaylistTracks(playlist.id, nextTracks);
      setTracks((current) => appendUnique(current, page.items)); setNextTracks(page.next);
    } catch (caught) { setError(message(caught)); }
    finally { setLoading(false); }
  }

  function useSelection() {
    onSelect(selectedTracksToSongs(tracks.filter((track) => selected.has(track.id))));
    document.getElementById('workout-builder')?.scrollIntoView({ behavior: 'smooth' });
  }

  return <section className="music-browser spotify-browser" aria-labelledby="spotify-heading">
    <div className="music-browser-heading"><div><p className="eyebrow">Library provider</p><h2 id="spotify-heading">Spotify</h2><p>Choose metadata from playlists you own or collaborate on. Playback and audio analysis are not enabled.</p></div>
      {!connected ? <button className="primary-button spotify-button" disabled={loading} onClick={connect}>{loading ? 'Connecting…' : 'Connect Spotify'}</button> : <button className="secondary-button" disabled={loading} onClick={disconnect}>Disconnect Spotify</button>}
    </div>
    <p className="provider-note">Spotify Development Mode is limited to allowlisted users. The app owner must have Premium.</p>
    {error ? <p className="api-error" role="alert">{error}</p> : null}
    {loading ? <p role="status">Loading Spotify…</p> : null}
    {connected && !playlist ? <div className="music-grid">{playlists.length === 0 && !loading ? <p className="empty-state">No accessible Spotify playlists were returned.</p> : playlists.map((item) => <div className="spotify-content-item" key={item.id}><button className="music-row" onClick={() => openPlaylist(item)}>
      <Artwork url={item.artworkUrl} name={item.name} /><span><strong>{item.name || 'Untitled playlist'}</strong><small>{item.trackCount ?? 'Unknown'} tracks</small></span>
    </button>{item.externalUrl ? <a className="spotify-content-link" href={item.externalUrl} target="_blank" rel="noreferrer">OPEN SPOTIFY</a> : null}</div>)}</div> : null}
    {connected && !playlist && nextPlaylists ? <button className="secondary-button" disabled={loading} onClick={loadMorePlaylists}>Load more playlists</button> : null}
    {playlist ? <div><button className="text-button" onClick={() => { setPlaylist(null); setTracks([]); setSelected(new Set()); }}>← All playlists</button>
      <div className="playlist-title"><h3>{playlist.name}</h3>{playlist.externalUrl ? <a href={playlist.externalUrl} target="_blank" rel="noreferrer">Open on Spotify</a> : null}</div>
      {tracks.length === 0 && !loading && !error ? <p className="empty-state">This playlist is empty.</p> : <div className="music-grid">{tracks.map((track) => {
        const usable = track.isPlayable && track.duration_ms > 0; const checked = selected.has(track.id);
        return <label className={`music-row ${usable ? '' : 'unavailable'}`} key={track.id}><input type="checkbox" disabled={!usable} checked={checked} onChange={() => setSelected((current) => toggle(current, track.id))} />
          <Artwork url={track.artwork_url} name={track.title} /><span><strong>{track.title || 'Unknown title'}</strong><small>{track.artist || 'Unknown artist'} · {track.duration_ms > 0 ? `${Math.round(track.duration_ms / 1000)} sec` : unavailableLabel(track)}</small>{track.externalUrl ? <a href={track.externalUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>View on Spotify</a> : null}</span>
        </label>;
      })}</div>}
      {nextTracks ? <button className="secondary-button" disabled={loading} onClick={loadMoreTracks}>Load more tracks</button> : null}
      <button className="primary-button spotify-button provider-generate" disabled={selected.size === 0} onClick={useSelection}>Continue to Generate Workout ({selected.size})</button>
    </div> : null}
    <a className="spotify-attribution" href="https://open.spotify.com" target="_blank" rel="noreferrer" aria-label="Open Spotify">
      <Image src="/spotify-full-logo-black.svg" alt="Spotify" width={100} height={28} />
    </a>
  </section>;
}

function Artwork({ url, name }: { url?: string; name: string }) {
  return <span className="music-artwork spotify-artwork" role={url ? 'img' : undefined} aria-label={url ? `${name} artwork` : undefined} style={url ? { backgroundImage: `url(${url})` } : undefined} />;
}
function toggle(current: Set<string>, id: string) { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }
function appendUnique<T extends { id: string }>(current: T[], next: T[]) { const ids = new Set(current.map((item) => item.id)); return [...current, ...next.filter((item) => !ids.has(item.id))]; }
function message(error: unknown) { return error instanceof Error ? error.message : 'Spotify is unavailable.'; }
function statusMessage(status: string) { return status === 'missing_permissions' ? 'Spotify playlist permission is missing. Disconnect and reconnect Spotify.' : 'Spotify authorization expired. Connect again.'; }
function unavailableLabel(track: SpotifyTrack) { return ({ local: 'Local tracks cannot be imported', not_track: 'Only music tracks are supported', unavailable: 'Unavailable in your market', missing_metadata: 'Duration unavailable' } as const)[track.unavailableReason ?? 'unavailable']; }
