"use client";

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AppleMusicBrowser from './apple-music-browser';
import SpotifyMusicBrowser from './spotify-music-browser';
import WorkoutApp from './workout-app';
import { WebAppleMusicService } from '../lib/apple-music/web-adapter';
import { createClient } from '../lib/supabase/client';
import { WebSpotifyMusicService } from '../lib/spotify/web-adapter';
import type { Song } from '../types/workout';

type ProviderCleanup = () => Promise<unknown>;
const PROVIDER_CLEANUP_TIMEOUT_MS = 2_000;

function shouldLeaveDashboardForAuthChange(event: string, nextUserId: string | undefined, expectedUserId: string) {
  return event === 'SIGNED_OUT' || Boolean(nextUserId && nextUserId !== expectedUserId);
}

async function cleanupProviders(
  cleanups: readonly ProviderCleanup[],
  timeoutMs = PROVIDER_CLEANUP_TIMEOUT_MS,
) {
  await Promise.all(cleanups.map((cleanup) => settleProviderCleanup(cleanup, timeoutMs)));
}

function settleProviderCleanup(cleanup: ProviderCleanup, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(finish, Math.max(0, timeoutMs));
    void Promise.resolve().then(cleanup).then(finish, finish);
  });
}

function providerCleanupsForUser(userId: string): ProviderCleanup[] {
  return [
    () => new WebAppleMusicService(userId).disconnect(),
    () => new WebSpotifyMusicService(userId).disconnect(),
  ];
}

async function performDashboardSignOut(
  cleanups: readonly ProviderCleanup[],
  supabaseSignOut: () => Promise<{ error: unknown | null }>,
  cleanupTimeoutMs = PROVIDER_CLEANUP_TIMEOUT_MS,
) {
  await cleanupProviders(cleanups, cleanupTimeoutMs);
  try {
    const { error } = await supabaseSignOut();
    return !error;
  } catch {
    return false;
  }
}

export default function DashboardShell({ email, userId }: { email: string; userId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const manualSignOut = useRef(false);
  const leavingDashboard = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (
        manualSignOut.current
        || leavingDashboard.current
        || !shouldLeaveDashboardForAuthChange(event, session?.user.id, userId)
      ) return;
      leavingDashboard.current = true;
      void cleanupProviders(providerCleanupsForUser(userId)).finally(() => {
        router.replace('/');
        router.refresh();
      });
    });
    return () => subscription.unsubscribe();
  }, [router, supabase, userId]);

  async function signOut() {
    if (signingOut) return;
    manualSignOut.current = true;
    setSigningOut(true);
    setSignOutError(null);
    const succeeded = await performDashboardSignOut(
      providerCleanupsForUser(userId),
      () => supabase.auth.signOut(),
    );
    manualSignOut.current = false;
    setSigningOut(false);
    if (!succeeded) {
      setSignOutError('BeatFit could not sign you out. Please try again.');
      return;
    }
    leavingDashboard.current = true;
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <div className="account-bar"><span>{email}</span><Link href="/dashboard/settings">Preferences</Link><button type="button" disabled={signingOut} onClick={signOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
      {signOutError ? <p className="api-error" role="alert">{signOutError}</p> : null}
      {process.env.NEXT_PUBLIC_APPLE_MUSIC_ENABLED === 'true' ? <AppleMusicBrowser beatFitUserId={userId} onSelect={setSelectedSongs} /> : null}
      {process.env.NEXT_PUBLIC_SPOTIFY_ENABLED === 'true' ? <SpotifyMusicBrowser beatFitUserId={userId} onSelect={setSelectedSongs} /> : null}
      <WorkoutApp importedSongs={selectedSongs} />
    </>
  );
}

export const dashboardShellTestExports = {
  cleanupProviders,
  performDashboardSignOut,
  shouldLeaveDashboardForAuthChange,
};
