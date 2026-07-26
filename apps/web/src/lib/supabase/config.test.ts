import { describe, expect, it } from 'vitest';
import {
  SupabasePublicConfigurationError,
  validateSupabasePublicConfig,
} from './config';

function jwtWithRole(role: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'none' })}.${encode({ role })}.signature`;
}

describe('Supabase public configuration', () => {
  it('accepts hosted HTTPS and loopback development URLs', () => {
    expect(validateSupabasePublicConfig({
      url: 'https://project.supabase.co/',
      publishableKey: 'sb_publishable_public',
    })).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_public',
    });
    expect(validateSupabasePublicConfig({
      url: 'http://127.0.0.1:54321',
      publishableKey: jwtWithRole('anon'),
    }).url).toBe('http://127.0.0.1:54321');
  });

  it.each([
    '',
    'https://your-project-ref.supabase.co',
    'http://project.supabase.co',
    'https://user:password@project.supabase.co',
    'https://@project.supabase.co',
    'https://project.supabase.co/auth/v1',
    'https://project.supabase.co?token=value',
    'https://configuration-required.invalid',
    'https://example.com/',
    'https://project.invalid/',
  ])('rejects an unsafe or placeholder URL: %s', (url) => {
    expect(() => validateSupabasePublicConfig({
      url,
      publishableKey: 'sb_publishable_public',
    })).toThrow(SupabasePublicConfigurationError);
  });

  it.each([
    '',
    'configuration-required',
    'sb_publishable_your_key',
    'sb_publishable_not valid',
    'sb_secret_server_only',
    jwtWithRole('service_role'),
    'header.not-json.signature',
  ])('rejects a missing, placeholder, or secret key', (publishableKey) => {
    expect(() => validateSupabasePublicConfig({
      url: 'https://project.supabase.co',
      publishableKey,
    })).toThrow(SupabasePublicConfigurationError);
  });
});
