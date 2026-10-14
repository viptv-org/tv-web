import type { JsonValue } from './types';
const fields = new Set(['poster', 'landscape', 'logo', 'background', 'thumbnail', 'icon']);

/** Public host image descriptors stay on the selected API origin, including saved presentations. */
export function engineArtwork(value: JsonValue, origin: string): JsonValue {
  if (Array.isArray(value)) return value.map(item => engineArtwork(item, origin));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    fields.has(key) && typeof item === 'string' && item.startsWith('/api/v3/images/simkl/')
      ? new URL(item, origin).href : engineArtwork(item ?? null, origin),
  ]));
  return value;
}

export function isEngineArtwork(value: string): boolean {
  try { return new URL(value).pathname.startsWith('/api/v3/images/simkl/'); }
  catch { return false; }
}
