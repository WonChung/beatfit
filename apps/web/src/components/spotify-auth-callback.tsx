"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WebSpotifyMusicService } from '@/lib/spotify/web-adapter';
import { createClient } from '@/lib/supabase/client';

let callbackAttempt: {
  key: string;
  promise: ReturnType<WebSpotifyMusicService['completeAuthorization']>;
} | undefined;

export default function SpotifyAuthCallback({ beatFitUserId }: { beatFitUserId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const service = new WebSpotifyMusicService(beatFitUserId);
    const search = new URLSearchParams(window.location.search);
    const attemptKey = [
      beatFitUserId,
      search.get('state') ?? 'missing-state',
      search.get('error') ?? 'authorization-code',
    ].join(':');
    if (!callbackAttempt || callbackAttempt.key !== attemptKey) {
      callbackAttempt = {
        key: attemptKey,
        promise: service.completeAuthorization(search, async () => {
          const { data } = await createClient().auth.getClaims();
          return String(data?.claims?.sub ?? '') === beatFitUserId;
        }),
      };
    }
    void callbackAttempt.promise
      .then((status) => {
        if (!active) return;
        router.replace(status === 'cancelled' ? '/dashboard?spotify=cancelled' : '/dashboard?spotify=connected');
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Spotify authorization failed.');
      });
    return () => { active = false; };
  }, [beatFitUserId, router]);

  return <main className="auth-shell"><section className="auth-card" aria-live="polite">
    <h1>BeatFit</h1>
    {error ? <><p className="api-error" role="alert">{error}</p><button className="primary-button" onClick={() => router.replace('/dashboard')}>Return to dashboard</button></> : <p role="status">Finishing Spotify connection…</p>}
  </section></main>;
}
