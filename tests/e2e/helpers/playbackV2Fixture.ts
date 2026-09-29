import type { Route, Page } from '@playwright/test';

const sessions = new WeakMap<Page, Map<string, Record<string, unknown>>>();
/** Project decoder fixture metadata into the actual v2 control envelope. */
export function playbackV2Fixture(route: Route, body: unknown, status = 200): unknown {
  const request = route.request(), url = new URL(request.url());
  if (!url.pathname.startsWith('/api/v2/playback') || status >= 400) return body;
  const page = request.frame().page();
  let values = sessions.get(page);
  if (!values) { values = new Map(); sessions.set(page, values); }
  const raw = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (raw.status) return body;
  const id = typeof raw.id === 'string' ? raw.id : url.pathname.split('/')[4];
  if (request.method() === 'DELETE') { values.delete(id); return {}; }
  if (typeof raw.url === 'string') {
    const direct = raw.kind === 'direct' || (raw.kind !== 'gateway' && raw.mode === 'direct');
    values.set(id, { ...raw, kind: direct ? 'direct' : 'gateway', url: new URL(raw.url, url.origin).href,
      format: direct ? 'original' : 'hls', mode: raw.mode ?? 'remux', headers: {},
      video_mode: raw.video_mode === 'transcode' ? 'encode' : raw.video_mode ?? 'copy',
      audio_mode: raw.audio_mode === 'transcode' ? 'encode' : raw.audio_mode ?? 'copy',
      position: raw.position ?? 0, duration: raw.duration ?? 0, live: raw.live ?? false,
      audio_tracks: raw.audio_tracks ?? [], subtitle_tracks: raw.subtitle_tracks ?? [], subtitles_supported: raw.subtitles_supported ?? false });
  }
  if (!values.has(id)) return body;
  return { id, status: 'ready', expires_at: Math.floor(Date.now()/1000)+60, renew_after_seconds: 20, delivery: values.get(id) };
}
