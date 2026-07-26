import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('./apple-music-browser', () => ({ default: vi.fn() }));
vi.mock('./spotify-music-browser', () => ({ default: vi.fn() }));
vi.mock('./workout-app', () => ({ default: vi.fn() }));
vi.mock('../lib/apple-music/web-adapter', () => ({ WebAppleMusicService: vi.fn() }));
vi.mock('../lib/spotify/web-adapter', () => ({ WebSpotifyMusicService: vi.fn() }));
vi.mock('../lib/supabase/client', () => ({ createClient: vi.fn() }));

import { dashboardShellTestExports } from './dashboard-shell';

describe('dashboard authentication lifecycle', () => {
  it('leaves only for sign-out or a different authenticated user', () => {
    const shouldLeave = dashboardShellTestExports.shouldLeaveDashboardForAuthChange;

    expect(shouldLeave('INITIAL_SESSION', 'user-a', 'user-a')).toBe(false);
    expect(shouldLeave('TOKEN_REFRESHED', 'user-a', 'user-a')).toBe(false);
    expect(shouldLeave('SIGNED_IN', 'user-a', 'user-a')).toBe(false);
    expect(shouldLeave('SIGNED_OUT', undefined, 'user-a')).toBe(true);
    expect(shouldLeave('INITIAL_SESSION', 'user-b', 'user-a')).toBe(true);
    expect(shouldLeave('TOKEN_REFRESHED', 'user-b', 'user-a')).toBe(true);
    expect(shouldLeave('SIGNED_IN', 'user-b', 'user-a')).toBe(true);
  });

  it('attempts every provider cleanup even when one fails', async () => {
    const appleCleanup = vi.fn().mockRejectedValue(new Error('MusicKit failed'));
    const spotifyCleanup = vi.fn().mockResolvedValue(undefined);

    await expect(dashboardShellTestExports.cleanupProviders([
      appleCleanup,
      spotifyCleanup,
    ])).resolves.toBeUndefined();
    expect(appleCleanup).toHaveBeenCalledOnce();
    expect(spotifyCleanup).toHaveBeenCalledOnce();
  });

  it('does not let a provider SDK block sign-out indefinitely', async () => {
    const hangingCleanup = vi.fn(() => new Promise<never>(() => {
      // Simulates a provider SDK promise that never settles.
    }));
    const supabaseSignOut = vi.fn(async () => ({ error: null }));

    await expect(dashboardShellTestExports.performDashboardSignOut(
      [hangingCleanup],
      supabaseSignOut,
      0,
    )).resolves.toBe(true);

    expect(hangingCleanup).toHaveBeenCalledOnce();
    expect(supabaseSignOut).toHaveBeenCalledOnce();
  });

  it('waits for provider cleanup and reports a Supabase sign-out error', async () => {
    const calls: string[] = [];
    const result = await dashboardShellTestExports.performDashboardSignOut(
      [
        async () => { calls.push('apple'); },
        async () => { calls.push('spotify'); },
      ],
      async () => {
        calls.push('supabase');
        return { error: new Error('safe details must not reach the UI') };
      },
    );

    expect(result).toBe(false);
    expect(calls.slice(0, 2).sort()).toEqual(['apple', 'spotify']);
    expect(calls[2]).toBe('supabase');
  });

  it('reports success only after Supabase confirms sign-out', async () => {
    await expect(dashboardShellTestExports.performDashboardSignOut(
      [async () => undefined],
      async () => ({ error: null }),
    )).resolves.toBe(true);

    await expect(dashboardShellTestExports.performDashboardSignOut(
      [async () => undefined],
      async () => { throw new Error('network'); },
    )).resolves.toBe(false);
  });
});
