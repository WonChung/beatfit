"use client";

import { useMemo, useState } from 'react';
import type { Song } from '@/types/workout';
import type { AppleMusicPlaylist, AppleMusicTrack } from '@/lib/apple-music/types';
import { toBeatFitSongs } from '@/lib/apple-music/types';
import { WebAppleMusicService } from '@/lib/apple-music/web-adapter';

export default function AppleMusicBrowser({ onSelect }: { onSelect: (songs: Song[]) => void }) {
  const service = useMemo(() => new WebAppleMusicService(), []);
  const [connected, setConnected] = useState(false);
  const [playlists, setPlaylists] = useState<AppleMusicPlaylist[]>([]);
  const [playlist, setPlaylist] = useState<AppleMusicPlaylist | null>(null);
  const [tracks, setTracks] = useState<AppleMusicTrack[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setLoading(true); setError(null);
    try {
      const status = await service.authorize();
      if (status !== 'authorized') throw new Error(statusMessage(status));
      setConnected(true); setPlaylists((await service.listPlaylists()).items);
    } catch (caught) { setError(message(caught)); } finally { setLoading(false); }
  }
  async function disconnect() {
    setLoading(true); setError(null);
    try { await service.disconnect(); setConnected(false); setPlaylists([]); setPlaylist(null); setTracks([]); setSelected(new Set()); onSelect([]); }
    catch (caught) { setError(message(caught)); } finally { setLoading(false); }
  }
  async function openPlaylist(item: AppleMusicPlaylist) {
    setLoading(true); setError(null); setPlaylist(item); setSelected(new Set());
    try { setTracks((await service.getPlaylistTracks(item.id)).items); }
    catch (caught) { setTracks([]); setError(message(caught)); } finally { setLoading(false); }
  }
  function useSelection() {
    onSelect(toBeatFitSongs(tracks.filter((track) => selected.has(track.id))));
    document.getElementById('workout-builder')?.scrollIntoView({ behavior: 'smooth' });
  }

  return <section className="music-browser" aria-labelledby="apple-music-heading">
    <div className="music-browser-heading"><div><p className="eyebrow">Library provider</p><h2 id="apple-music-heading">Apple Music</h2><p>Select playlist tracks before generating your workout. Playback is not enabled yet.</p></div>
      {!connected ? <button className="primary-button" disabled={loading} onClick={connect}>{loading ? 'Connecting…' : 'Connect Apple Music'}</button> : <button className="secondary-button" disabled={loading} onClick={disconnect}>Disconnect</button>}
    </div>
    {error ? <p className="api-error" role="alert">{error}</p> : null}
    {loading ? <p role="status">Loading Apple Music…</p> : null}
    {connected && !playlist ? <div className="music-grid">{playlists.length === 0 && !loading ? <p className="empty-state">Your Apple Music library has no playlists.</p> : playlists.map((item) => <button className="music-row" key={item.id} onClick={() => openPlaylist(item)}>
      <span className="music-artwork" aria-hidden="true" style={item.artworkUrl ? { backgroundImage: `url(${item.artworkUrl})` } : undefined} /><span><strong>{item.name || 'Untitled playlist'}</strong><small>{item.trackCount ?? 'Unknown'} tracks</small></span>
    </button>)}</div> : null}
    {playlist ? <div><button className="text-button" onClick={() => { setPlaylist(null); setTracks([]); }}>← All playlists</button><h3>{playlist.name}</h3>
      {tracks.length === 0 && !loading ? <p className="empty-state">This playlist has no available tracks.</p> : <div className="music-grid">{tracks.map((track) => {
        const usable = track.isPlayable && track.duration_ms > 0; const checked = selected.has(track.id);
        return <label className={`music-row ${usable ? '' : 'unavailable'}`} key={track.id}><input type="checkbox" disabled={!usable} checked={checked} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(track.id)) next.delete(track.id); else next.add(track.id); return next; })} />
          <span className="music-artwork" aria-hidden="true" style={track.artwork_url ? { backgroundImage: `url(${track.artwork_url})` } : undefined} /><span><strong>{track.title || 'Unknown title'}</strong><small>{track.artist || 'Unknown artist'} · {track.duration_ms > 0 ? `${Math.round(track.duration_ms / 1000)} sec` : 'Duration unavailable'}</small></span>
        </label>;
      })}</div>}
      <button className="primary-button" disabled={selected.size === 0} onClick={useSelection}>Use {selected.size} selected track{selected.size === 1 ? '' : 's'}</button>
    </div> : null}
  </section>;
}

function message(error: unknown) { return error instanceof Error ? error.message : 'Apple Music is unavailable.'; }
function statusMessage(status: string) { return ({ denied: 'Apple Music permission was denied.', cancelled: 'Apple Music authorization was cancelled.', no_subscription: 'An active Apple Music subscription is required.', expired: 'Apple Music authorization expired.', unavailable: 'Apple Music is unavailable.' } as Record<string, string>)[status] ?? 'Apple Music could not be connected.'; }
