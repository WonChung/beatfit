import { describe, expect, it } from 'vitest';
import { shouldAllowDashboard } from './auth-guard';

describe('protected dashboard', () => {
  it('rejects an unauthenticated render', () => {
    expect(shouldAllowDashboard(false)).toBe(false);
  });

  it('allows a server-verified user', () => {
    expect(shouldAllowDashboard(true)).toBe(true);
  });
});
