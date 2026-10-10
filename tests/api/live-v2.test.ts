import { expect, it } from 'vitest';
import { apiFor, response, scripted } from './client-helpers';
import { normalizeResponse } from '../../src/api/client-shared';
import type { PlaybackV2Request } from '../../vendor/core/typescript/wire';
import { TvApi } from '../../src/api';

const card = { id: 'opaque_live', source: 'iptv:1', source_addon_id: 'iptv:1', name: 'Provider', title: 'News', source_fingerprint: 'stable' };
const page = { catalog_id: 1, generation: 7, items: [{ id: 'iptv:1:9', name: 'Zulu', logo: 'http://images.example/logo.png' }, { id: 'iptv:1:1', name: 'Alpha' }], next_cursor: 'next_page', previous_cursor: null };

it('loads only the requested default live page and preserves its original cursor filters', async () => {
  const fake = scripted(response(page), response({ ...page, items: [], next_cursor: null }));
  const api = apiFor(fake.fetcher);
  const first = await api.liveV2({ limit: 2 });
  expect(first.items.map(item => item.id)).toEqual(['iptv:1:9', 'iptv:1:1']);
  expect(first.items[0].poster).toBe('http://images.example/logo.png');
  expect(first).not.toHaveProperty('total');
  expect(first.previousCursor).toBeNull();
  expect(fake.calls).toHaveLength(1);
  await api.liveV2({ limit: 2, cursor: first.nextCursor! });
  expect(fake.calls.map(call => call.input)).toEqual([
    'https://viptv.example/api/v2/iptv/live/channels?limit=2',
    'https://viptv.example/api/v2/iptv/live/channels?limit=2&cursor=next_page',
  ]);
  expect(fake.calls.every(call => call.init?.redirect === 'error')).toBe(true);
});

it('keeps profile collections and explicit playlist overrides in canonical core requests', async () => {
  const fake = scripted(response({ ...page, catalog_id: 2 }), response({ ...page, catalog_id: 2, items: [{ id: 'news', name: 'News', count: 999 }] }));
  const api = apiFor(fake.fetcher);
  await api.liveV2({ collection: 'favorites', catalogId: '2', search: ' News ', limit: 40 });
  const categories = await api.liveCategoriesV2({ catalogId: '2', limit: 40 });
  expect(fake.calls[0].input).toBe('https://viptv.example/api/v2/iptv/live/channels?limit=40&collection=favorites&catalog_id=2&search=News');
  expect(categories.items[0]).toEqual({ id: 'news', name: 'News' });
});

it('resolves one exact live source and admits its opaque id through v2 without a discovery job', async () => {
  const fake = scripted(response({ source: { ...card, integration_key: 'private-key' } }), response({ id: 'pb2_live', status: 'ready', expires_at: Math.floor(Date.now()/1000)+60, renew_after_seconds: 20,
    delivery: { kind: 'gateway', url: 'https://gateway.example/media/viewer/cap/index.m3u8', format: 'hls', mode: 'direct', video_mode: 'copy', audio_mode: 'copy', position: 0, duration: 0, live: true, audio_tracks: [], subtitle_tracks: [], subtitles_supported: false } }), response({}));
  const api = apiFor(fake.fetcher);
  const source = await api.liveSourceV2('iptv:1:7');
  expect(JSON.stringify(source)).not.toContain('private-key');
  const input = normalizeResponse<PlaybackV2Request>('playbackV2Intent', { requestId: 'live_request', platform: 'vizio', playback: { streamId: source.id, capabilities: { maxWidth: 3840, maxHeight: 2160, h264: true, aac: true, directUrls: true } } });
  const ready = await api.startPlaybackV2(input);
  expect(ready.session).toMatchObject({ live: true, deliveryKind: 'gateway', mode: 'direct', position: 0 });
  await api.stopPlayback(ready.id);
  expect(fake.calls.map(call => call.input)).toEqual(['https://viptv.example/api/v2/iptv/live/iptv%3A1%3A7/source', 'https://viptv.example/api/v2/playback-decoder-start', 'https://viptv.example/api/v2/playback/pb2_live']);
  expect(JSON.parse(fake.calls[1].init!.body as string)).toMatchObject({ stream_id: 'opaque_live', client: { platform: 'vizio', can_play_direct: false, max_height: 2160 } });
});

it('reads a selected raw channel guide through its v2 control route', async () => {
  const fake = scripted(response({ timezone: 'UTC', programs: [{ title: 'News', start: 10, end: 20 }] }));
  const guide = await apiFor(fake.fetcher).guideV2('iptv:1:7');
  expect(guide.programs[0]).toMatchObject({ title: 'News', start: 10, end: 20 });
  expect(fake.calls[0].input).toBe('https://viptv.example/api/v2/iptv/guide/iptv%3A1%3A7');
});

it('rejects obsolete queries locally and old responses without falling back to legacy paths', async () => {
  const fake = scripted(response({ channels: [], total: 0 }));
  const api = apiFor(fake.fetcher);
  await expect(api.liveV2({ limit: 201 })).rejects.toMatchObject({ status: 400, code: 'invalid_catalog_query' });
  expect(fake.calls).toHaveLength(0);
  await expect(api.liveV2()).rejects.toMatchObject({ status: 502, code: 'invalid_catalog_response' });
  expect(fake.calls).toHaveLength(1);
});

it('requires the reverse paging contract on successful channel responses', async () => {
  const { previous_cursor: _previous, ...missingReverse } = page;
  const fake = scripted(response(missingReverse));
  await expect(apiFor(fake.fetcher).liveV2()).rejects.toMatchObject({ status: 502, code: 'invalid_catalog_response' });
  expect(fake.calls).toHaveLength(1);
});

it('preserves catalog-change and parent reasons without exposing raw errors or replacing the playlist', async () => {
  const fake = scripted(response({ error_code: 'catalog_changed', error: 'https://private.example/token' }, 409), response({ error_code: 'parent_required', error: 'Parent PIN required' }, 403));
  const api = apiFor(fake.fetcher);
  await expect(api.liveV2({ cursor: 'old_cursor' })).rejects.toMatchObject({ code: 'catalog_changed', message: expect.stringContaining('Reload') });
  await expect(api.liveSourceV2('iptv:1:7')).rejects.toMatchObject({ status: 403, code: 'parent_required' });
  expect(fake.calls).toHaveLength(2);
});

it('rejects oversized pages and a substituted explicit playlist', async () => {
  const fake = scripted(response(page), response(page), response({ ...page, items: [{ id: 'news', name: 'News' }] }));
  const api = apiFor(fake.fetcher);
  await expect(api.liveV2({ limit: 1 })).rejects.toMatchObject({ status: 502, code: 'invalid_catalog_response' });
  await expect(api.liveV2({ catalogId: '2' })).rejects.toMatchObject({ status: 502, code: 'invalid_catalog_response' });
  await expect(api.liveCategoriesV2({ catalogId: '2' })).rejects.toMatchObject({ status: 502, code: 'invalid_catalog_response' });
});

it('normal live playback resolves the exact channel and never invokes legacy discovery or playback', async () => {
  const fake = scripted(response({ source: card }), response({ id: 'pb2_live', status: 'ready', expires_at: Math.floor(Date.now()/1000)+60, renew_after_seconds: 20,
    delivery: { kind: 'gateway', url: 'https://gateway.example/media/viewer/cap/index.m3u8', format: 'hls', mode: 'direct', video_mode: 'copy', audio_mode: 'copy', position: 0, duration: 0, live: true, audio_tracks: [], subtitle_tracks: [], subtitles_supported: false } }));
  const api = new TvApi({ baseUrl: 'https://viptv.example', fetch: fake.fetcher, playbackPlatform: 'vizio' });
  const session = await api.startPlayback({ channelId: 'iptv:1:7', position: 88, capabilities: { maxWidth: 3840, maxHeight: 2160, h264: true, aac: true, hevc: false, directPlay: false, hevcSdr: false } });
  expect(session.id).toBe('pb2_live');
  expect(fake.calls.map(call => call.input)).toEqual(['https://viptv.example/api/v2/iptv/live/iptv%3A1%3A7/source', 'https://viptv.example/api/v2/playback-decoder-start']);
  expect(JSON.parse(fake.calls[1].init!.body as string)).toMatchObject({ stream_id: 'opaque_live', position: 0, client: { platform: 'vizio', can_play_direct: false } });
});
