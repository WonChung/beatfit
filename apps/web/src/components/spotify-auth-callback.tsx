"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WebSpotifyMusicService } from '@/lib/spotify/web-adapter';

let callbackAttempt: {
  beatFitUserId: string;
  promise: ReturnType<WebSpotifyMusicService['completeAuthorization']>;
} | undefined;

export default function SpotifyAuthCallback({ beatFitUserId }: { beatFitUserId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const service = new WebSpotifyMusicService(beatFitUserId);
    if (!callbackAttempt || callbackAttempt.beatFitUserId !== beatFitUserId) {
      callbackAttempt = {
        beatFitUserId,
        promise: service.completeAuthorization(new URLSearchParams(window.location.search)),
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
