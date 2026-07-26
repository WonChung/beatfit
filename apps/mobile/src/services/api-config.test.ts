import { describe, expect, it } from '@jest/globals';

import { resolveApiBaseUrl } from '@/services/api-config';

describe('BeatFit API public configuration', () => {
  it('uses the documented local fallback when the value is absent', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://127.0.0.1:8000');
  });

  it('normalizes HTTPS, emulator, and LAN development origins', () => {
    expect(resolveApiBaseUrl('https://api.beatfit.example/v1/'))
      .toBe('https://api.beatfit.example/v1');
    expect(resolveApiBaseUrl('http://10.0.2.2:8000/')).toBe('http://10.0.2.2:8000');
    expect(resolveApiBaseUrl('http://192.168.1.25:8000')).toBe('http://192.168.1.25:8000');
  });

  it.each([
    'not a URL',
    'ftp://api.example.com',
    'https://user:password@api.example.com',
    'https://@api.example.com',
    'https://api.example.com?token=secret',
    'https://api.example.com/#fragment',
  ])('drops an invalid or credential-bearing URL: %s', (value) => {
    const result = resolveApiBaseUrl(value);
    expect(result).toBe('http://127.0.0.1:8000');
    expect(result).not.toContain('secret');
    expect(result).not.toContain('password');
  });
});
