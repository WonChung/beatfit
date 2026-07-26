import { describe, expect, it } from '@jest/globals';

import { validateSupabasePublicConfig } from '@/services/supabase-config';

const PUBLIC_KEY = 'sb_publishable_valid_public_key';
const JWT_HEADER = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
const ANON_JWT = `${JWT_HEADER}.eyJyb2xlIjoiYW5vbiJ9.signature`;
const SERVICE_ROLE_JWT =
  `${JWT_HEADER}.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature`;

describe('Supabase public configuration', () => {
  it.each([
    ['hosted HTTPS', 'https://abcdefghijklmnopqrst.supabase.co'],
    ['custom-domain HTTPS', 'https://auth.beatfit.app'],
    ['localhost HTTP', 'http://localhost:54321'],
    ['IPv4 loopback HTTP', 'http://127.0.0.42:54321'],
    ['IPv6 loopback HTTP', 'http://[::1]:54321'],
  ])('accepts %s URLs', (_caseName, url) => {
    expect(validateSupabasePublicConfig(url, PUBLIC_KEY)).toEqual({
      isConfigured: true,
      url,
      publishableKey: PUBLIC_KEY,
    });
  });

  it('trims values, normalizes a trailing slash, and accepts a legacy anon JWT', () => {
    expect(
      validateSupabasePublicConfig(
        '  https://abcdefghijklmnopqrst.supabase.co/  ',
        `  ${ANON_JWT}  `
      )
    ).toEqual({
      isConfigured: true,
      url: 'https://abcdefghijklmnopqrst.supabase.co',
      publishableKey: ANON_JWT,
    });
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['environment placeholder', 'https://your-project-ref.supabase.co'],
    ['alternate project placeholder', 'https://your-project-id.supabase.co'],
    ['internal fallback placeholder', 'https://configuration-required.invalid'],
    ['legacy fallback placeholder', 'https://configuration-required.supabase.co'],
    ['reserved example placeholder', 'https://example.com'],
    ['malformed', 'not a URL'],
    ['non-HTTP protocol', 'ftp://abcdefghijklmnopqrst.supabase.co'],
    ['remote HTTP', 'http://abcdefghijklmnopqrst.supabase.co'],
    ['lookalike loopback HTTP', 'http://localhost.evil.example'],
    ['userinfo', 'https://user:password@abcdefghijklmnopqrst.supabase.co'],
    ['empty userinfo', 'https://@abcdefghijklmnopqrst.supabase.co'],
    ['query string', 'https://abcdefghijklmnopqrst.supabase.co?debug=true'],
    ['fragment', 'https://abcdefghijklmnopqrst.supabase.co#fragment'],
    ['non-root path', 'https://abcdefghijklmnopqrst.supabase.co/auth'],
  ])('rejects a %s URL', (_caseName, url) => {
    expect(validateSupabasePublicConfig(url, PUBLIC_KEY).isConfigured).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['embedded whitespace', 'sb_publishable_not valid'],
    ['publishable placeholder', 'sb_publishable_your_key'],
    ['generic placeholder', 'your_supabase_anon_key'],
    ['replacement placeholder', 'replace-me'],
    ['modern secret', 'sb_secret_server_only_key'],
    ['case-varied modern secret', 'SB_SECRET_server_only_key'],
    ['legacy service-role JWT', SERVICE_ROLE_JWT],
    ['malformed legacy JWT', `${JWT_HEADER}.not-json.signature`],
  ])('rejects a %s key', (_caseName, key) => {
    expect(
      validateSupabasePublicConfig('https://abcdefghijklmnopqrst.supabase.co', key)
        .isConfigured
    ).toBe(false);
  });

  it('returns safe fallbacks when Expo public variables are absent', () => {
    expect(validateSupabasePublicConfig(undefined, undefined)).toEqual({
      isConfigured: false,
      url: 'https://configuration-required.invalid',
      publishableKey: 'configuration-required',
    });
  });

  it('returns fixed safe fallbacks without retaining rejected input', () => {
    const result = validateSupabasePublicConfig(
      'http://remote.internal.example',
      'sb_secret_do-not-retain'
    );

    expect(result).toEqual({
      isConfigured: false,
      url: 'https://configuration-required.invalid',
      publishableKey: 'configuration-required',
    });
    expect(JSON.stringify(result)).not.toContain('remote.internal.example');
    expect(JSON.stringify(result)).not.toContain('do-not-retain');
  });
});
