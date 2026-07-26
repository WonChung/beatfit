const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Keeps malformed URLs and embedded credentials out of the client. HTTP
 * remains available for loopback, emulator, and LAN development; release
 * configuration is documented and reviewed as HTTPS-only.
 */
export function resolveApiBaseUrl(rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) return LOCAL_API_BASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return LOCAL_API_BASE_URL;
  }

  const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1];
  if (
    !authority
    || authority.includes('@')
    || !['http:', 'https:'].includes(parsed.protocol)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    return LOCAL_API_BASE_URL;
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}
