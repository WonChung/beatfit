const SAFE_FALLBACK_URL = 'https://configuration-required.invalid';
const SAFE_FALLBACK_PUBLISHABLE_KEY = 'configuration-required';

export interface SupabasePublicConfig {
  isConfigured: boolean;
  url: string;
  publishableKey: string;
}

/**
 * Validates public client configuration without throwing during module import.
 * Invalid input is replaced rather than returned so secrets cannot accidentally
 * flow into a client created in the unconfigured state.
 */
export function validateSupabasePublicConfig(
  rawUrl: string | undefined,
  rawPublishableKey: string | undefined
): SupabasePublicConfig {
  const url = rawUrl?.trim() ?? '';
  const publishableKey = rawPublishableKey?.trim() ?? '';
  const normalizedUrl = normalizePublicSupabaseUrl(url);

  if (!normalizedUrl || !isPublicSupabaseKey(publishableKey)) {
    return {
      isConfigured: false,
      url: SAFE_FALLBACK_URL,
      publishableKey: SAFE_FALLBACK_PUBLISHABLE_KEY,
    };
  }

  return {
    isConfigured: true,
    url: normalizedUrl,
    publishableKey,
  };
}

function normalizePublicSupabaseUrl(value: string): string | null {
  if (!value || value.includes('?') || value.includes('#')) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1];
  if (
    !authority ||
    authority.includes('@') ||
    parsed.username ||
    parsed.password ||
    (parsed.pathname !== '' && parsed.pathname !== '/') ||
    isPlaceholderHostname(parsed.hostname)
  ) {
    return null;
  }

  if (parsed.protocol === 'https:') return parsed.origin;
  if (parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname)) {
    return parsed.origin;
  }
  return null;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized === '::1') return true;

  const octets = normalized.split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) {
    return false;
  }
  const numbers = octets.map(Number);
  return numbers[0] === 127 && numbers.every((octet) => octet >= 0 && octet <= 255);
}

function isPlaceholderHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'configuration-required.invalid' ||
    normalized === 'example.supabase.co' ||
    normalized === 'example.com' ||
    normalized === 'example.net' ||
    normalized === 'example.org' ||
    normalized.endsWith('.example') ||
    normalized.endsWith('.invalid') ||
    normalized.endsWith('.test') ||
    normalized.includes('configuration-required') ||
    normalized.includes('placeholder') ||
    normalized.includes('your-project') ||
    normalized.includes('your_project') ||
    normalized.includes('project-ref') ||
    normalized.includes('project_ref')
  );
}

function isPublicSupabaseKey(value: string): boolean {
  if (!value || /\s/.test(value)) return false;

  const normalized = value.toLowerCase();
  if (
    normalized.startsWith('sb_secret_') ||
    normalized === SAFE_FALLBACK_PUBLISHABLE_KEY ||
    normalized === 'sb_publishable_your_key' ||
    normalized === 'your_supabase_publishable_key' ||
    normalized === 'your_supabase_anon_key' ||
    normalized === 'your-anon-key' ||
    normalized === 'your_anon_key' ||
    normalized.includes('placeholder') ||
    normalized.includes('_your_') ||
    normalized.includes('-your-') ||
    normalized.startsWith('your_') ||
    normalized.startsWith('your-') ||
    normalized === 'replace-me' ||
    normalized === 'replace_me' ||
    normalized === 'changeme' ||
    normalized === 'change-me' ||
    normalized === 'change_me' ||
    value.includes('<') ||
    value.includes('>')
  ) {
    return false;
  }

  const segments = value.split('.');
  if (segments.length === 3) {
    const payload = decodeJwtPayload(segments[1]);
    return payload !== null && payload.role !== 'service_role';
  }

  return true;
}

function decodeJwtPayload(segment: string): Record<string, unknown> | null {
  if (!segment || !/^[A-Za-z\d_-]+={0,2}$/.test(segment)) return null;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (normalized.length % 4 === 1) return null;

  let decoded = '';
  let bits = 0;
  let bitCount = 0;

  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value < 0) return null;
    bits = (bits << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      decoded += String.fromCharCode((bits >> bitCount) & 0xff);
      bits &= (1 << bitCount) - 1;
    }
  }

  try {
    const payload: unknown = JSON.parse(decoded);
    return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
