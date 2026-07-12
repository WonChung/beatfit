import { describe, expect, it } from '@jest/globals';

import { initialAuthState, restoredAuthState, toFriendlyAuthError } from './auth-store';

describe('mobile authentication state', () => {
  it('blocks protected content until restoration completes', () => {
    expect(initialAuthState).toEqual({ session: null, isRestoring: true });
    expect(restoredAuthState(null)).toEqual({ session: null, isRestoring: false });
  });

  it('turns invalid credentials into a clear error', () => {
    expect(toFriendlyAuthError('Invalid login credentials')).toBe('Incorrect email or password.');
  });
});
