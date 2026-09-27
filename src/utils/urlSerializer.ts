import { deflate, inflate } from 'pako';

/** Serialize any JSON-serializable object to a compact Base64Url string via gzip. */
export function serialize(data: unknown): string {
  const json = JSON.stringify(data);
  const compressed = deflate(json);
  // Standard Base64 → URL-safe Base64 (replace + / with - _)
  return btoa(String.fromCharCode(...compressed))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function deserialize<T>(encoded: string): T | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const json = inflate(bytes, { to: 'string' });
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

const URL_PARAM = 'state';

export function saveToUrl(data: unknown): void {
  const encoded = serialize(data);
  const url = new URL(window.location.href);
  url.searchParams.set(URL_PARAM, encoded);
  window.history.replaceState(null, '', url.toString());
}

export function loadFromUrl<T>(): T | null {
  const url = new URL(window.location.href);
  const encoded = url.searchParams.get(URL_PARAM);
  if (!encoded) return null;
  return deserialize<T>(encoded);
}
