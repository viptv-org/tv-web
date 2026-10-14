import { describe, expect, it, vi } from 'vitest';
import { engineSubtitleText } from '../../src/api/engine-subtitle-text';

describe('normalized subtitle content transport', () => {
  it('uses only the selected API origin, rejecting redirects, and retries a rotated session', async () => {
    let token = 'old';
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => token === 'old'
      ? new Response('', { status: 401 }) : new Response('WEBVTT\n', { headers: { 'content-type': 'text/vtt; charset=utf-8' } }));
    const refresh = vi.fn(async () => { token = 'new'; });
    expect(await engineSubtitleText(fetcher, 'https://api.example', 'opaque/id', () => token, refresh)).toBe('WEBVTT\n');
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['https://api.example/api/v3/subtitle-content/opaque%2Fid', 'https://api.example/api/v3/subtitle-content/opaque%2Fid']);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer new' } });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('rejects non-VTT and oversized streamed bytes even without a content-length', async () => {
    const invalid = vi.fn(async () => new Response('HTML', { headers: { 'content-type': 'text/html' } }));
    await expect(engineSubtitleText(invalid, 'https://api.example', 'id', () => undefined, async () => {})).rejects.toMatchObject({ status: 502 });
    const oversized = vi.fn(async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { 'content-type': 'text/vtt' } }));
    await expect(engineSubtitleText(oversized, 'https://api.example', 'id', () => undefined, async () => {})).rejects.toMatchObject({ status: 502 });
  });
});
