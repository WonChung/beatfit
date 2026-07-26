const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000';

export class ApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigurationError';
  }
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? '',
    process.env.NODE_ENV ?? 'development',
  );
}

export function resolveApiBaseUrl(value: string, environment: string): string {
  if (!value) {
    if (environment !== 'production') return LOCAL_API_BASE_URL;
    throw new ApiConfigurationError(
      'NEXT_PUBLIC_API_BASE_URL must be configured for a production build.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiConfigurationError('NEXT_PUBLIC_API_BASE_URL must be a valid URL.');
  }

  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1];
  if (
    !['http:', 'https:'].includes(parsed.protocol)
    || (environment === 'production' && parsed.protocol !== 'https:' && !isLoopback)
    || !authority
    || authority.includes('@')
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new ApiConfigurationError(
      'NEXT_PUBLIC_API_BASE_URL must be an HTTP(S) base URL without credentials, a query, or a fragment.',
    );
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}
