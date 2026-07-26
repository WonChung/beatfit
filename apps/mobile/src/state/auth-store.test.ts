import { describe, expect, it, jest } from '@jest/globals';

import {
  AuthSessionRestoration,
  initialAuthState,
  restoredAuthState,
  shouldDisconnectMusicProviders,
  signOutSession,
  toFriendlyAuthError,
} from './auth-store';

describe('mobile authentication state', () => {
  it('blocks protected content until restoration completes', () => {
    expect(initialAuthState).toEqual({ session: null, isRestoring: true });
    expect(restoredAuthState(null)).toEqual({ session: null, isRestoring: false });
  });

  it('turns invalid credentials into a clear error', () => {
    expect(toFriendlyAuthError('Invalid login credentials')).toBe('Incorrect email or password.');
  });

  it('ignores a stale restoration result after an auth event arrives', () => {
    const restoration = new AuthSessionRestoration();
    expect(restoration.shouldApplyRestoredSession()).toBe(true);

    restoration.recordAuthEvent();

    expect(restoration.shouldApplyRestoredSession()).toBe(false);
  });

  it('identifies logout and account switching without treating initial restoration as a switch', () => {
    expect(shouldDisconnectMusicProviders(null, 'user-a')).toBe(false);
    expect(shouldDisconnectMusicProviders('user-a', 'user-a')).toBe(false);
    expect(shouldDisconnectMusicProviders('user-a', null)).toBe(true);
    expect(shouldDisconnectMusicProviders('user-a', 'user-b')).toBe(true);
  });

  it('clears every provider before signing out even when one provider cleanup fails', async () => {
    const calls: string[] = [];
    const providers = [
      {
        disconnect: jest.fn(async () => {
          calls.push('apple');
          throw new Error('Native module unavailable');
        }),
      },
      {
        disconnect: jest.fn(async () => {
          calls.push('spotify');
        }),
      },
    ];
    const signOut = jest.fn(async () => {
      calls.push('supabase');
      return { error: null };
    });

    await expect(signOutSession(signOut, providers)).resolves.toBeUndefined();

    expect(providers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(providers[1].disconnect).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(calls.at(-1)).toBe('supabase');
  });

  it('surfaces a Supabase sign-out failure after provider cleanup', async () => {
    const provider = { disconnect: jest.fn(async () => undefined) };

    await expect(
      signOutSession(async () => ({ error: { message: 'Sign out failed.' } }), [provider])
    ).rejects.toThrow('Sign out failed.');
    expect(provider.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not let a provider SDK block Supabase sign-out indefinitely', async () => {
    const provider = {
      disconnect: jest.fn(() => new Promise<void>(() => {
        // Simulates a provider SDK promise that never settles.
      })),
    };
    const signOut = jest.fn(async () => ({ error: null }));

    await expect(signOutSession(signOut, [provider], 0)).resolves.toBeUndefined();

    expect(provider.disconnect).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
