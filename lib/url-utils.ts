/**
 * Accepts only http/https URLs; returns null for anything else (including
 * javascript: URIs) to prevent XSS when the value is rendered as an href.
 */
export function sanitizeUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url
  } catch {}
  return null
}
