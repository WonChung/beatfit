export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export class SupabasePublicConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabasePublicConfigurationError';
  }
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  return validateSupabasePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '',
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
  });
}

export function validateSupabasePublicConfig(
  config: SupabasePublicConfig,
): SupabasePublicConfig {
  const url = validateSupabaseUrl(config.url);
  const publishableKey = config.publishableKey.trim();
  const keySegments = publishableKey.split('.');
  const legacyJwtRole = keySegments.length === 3 ? jwtRole(publishableKey) : undefined;
  if (
    !publishableKey
    || /\s/.test(publishableKey)
    || isPlaceholder(publishableKey)
    || publishableKey.toLowerCase().startsWith('sb_secret_')
    || (keySegments.length === 3 && legacyJwtRole !== 'anon')
  ) {
    throw new SupabasePublicConfigurationError(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must contain a public Supabase key.',
    );
  }
  return { url, publishableKey };
}

function validateSupabaseUrl(value: string): string {
  if (!value) {
    throw new SupabasePublicConfigurationError(
      'NEXT_PUBLIC_SUPABASE_URL must be configured.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new SupabasePublicConfigurationError(
      'NEXT_PUBLIC_SUPABASE_URL must be a valid URL.',
    );
  }

  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1];
  if (
    isPlaceholder(value)
    || isPlaceholderHostname(parsed.hostname)
    || (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback))
    || !authority
    || authority.includes('@')
    || parsed.username
    || parsed.password
    || (parsed.pathname !== '/' && parsed.pathname !== '')
    || parsed.search
    || parsed.hash
  ) {
    throw new SupabasePublicConfigurationError(
      'NEXT_PUBLIC_SUPABASE_URL must be HTTPS (or loopback HTTP) with no path or credentials.',
    );
  }
  return parsed.origin;
}

function isPlaceholderHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'example.com'
    || normalized.endsWith('.example.com')
    || normalized === 'example.net'
    || normalized.endsWith('.example.net')
    || normalized === 'example.org'
    || normalized.endsWith('.example.org')
    || normalized.endsWith('.example')
    || normalized.endsWith('.invalid')
    || normalized.endsWith('.test');
}

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('configuration-required')
    || normalized.includes('your-project-ref')
    || normalized.includes('your_key')
    || normalized === 'https://example.com'
    || normalized.endsWith('.example')
    || normalized.endsWith('.invalid');
}

function jwtRole(value: string): string | undefined {
  const encodedPayload = value.split('.')[1];
  if (!encodedPayload) return undefined;
  try {
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(globalThis.atob(padded)) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : undefined;
  } catch {
    return undefined;
  }
}
