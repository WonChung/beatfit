import { describe, expect, it } from 'vitest';
import { ApiConfigurationError, resolveApiBaseUrl } from './api-config';

describe('public API configuration', () => {
  it('uses the loopback API only outside production', () => {
    expect(resolveApiBaseUrl('', 'test')).toBe('http://127.0.0.1:8000');
    expect(() => resolveApiBaseUrl('', 'production')).toThrow(ApiConfigurationError);
  });

  it('normalizes configured service URLs and permits an API gateway path', () => {
    expect(resolveApiBaseUrl('https://api.example.com/beatfit/', 'production'))
      .toBe('https://api.example.com/beatfit');
    expect(resolveApiBaseUrl('http://127.0.0.1:8000/', 'production'))
      .toBe('http://127.0.0.1:8000');
  });

  it.each([
    'ftp://api.example.com',
    'http://api.example.com',
    'https://user:password@api.example.com',
    'https://@api.example.com',
    'https://api.example.com?token=value',
    'https://api.example.com/#fragment',
  ])('rejects an unsafe production URL: %s', (value) => {
    expect(() => resolveApiBaseUrl(value, 'production')).toThrow(ApiConfigurationError);
  });
});
