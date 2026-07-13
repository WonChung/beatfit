"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AppleMusicBrowser from '@/components/apple-music-browser';
import SpotifyMusicBrowser from '@/components/spotify-music-browser';
import WorkoutApp from '@/components/workout-app';
import { createClient } from '@/lib/supabase/client';
import { WebSpotifyMusicService } from '@/lib/spotify/web-adapter';
import type { Song } from '@/types/workout';

export default function DashboardShell({ email, userId }: { email: string; userId: string }) {
  const router = useRouter();
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  async function signOut() {
    await new WebSpotifyMusicService(userId).disconnect().catch(() => undefined);
    await createClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }
  return (
    <>
      <div className="account-bar"><span>{email}</span><button type="button" onClick={signOut}>Sign out</button></div>
      {process.env.NEXT_PUBLIC_APPLE_MUSIC_ENABLED === 'true' ? <AppleMusicBrowser onSelect={setSelectedSongs} /> : null}
      {process.env.NEXT_PUBLIC_SPOTIFY_ENABLED === 'true' ? <SpotifyMusicBrowser beatFitUserId={userId} onSelect={setSelectedSongs} /> : null}
      <WorkoutApp importedSongs={selectedSongs} />
    </>
  );
}
