import { describe, expect, it, vi } from 'vitest';
import { EngineLiveTransport } from '../../src/api/engine-live';
import type { JsonValue } from '../../src/api/types';

const page = { channels: [{ id: 'opaque:m3u/channel', connection_id: 'opaque-connection',
  card: { identity: { id: 'opaque:m3u/channel', kind: 'channel', ids: [], edition: null, episode: null },
    title: 'News', provider_id: 'm3u', metadata: null, parent_identity: null } }],
  groups: [{ id: 'opaque:group', label: 'News' }], connections: [{ id: 'opaque-connection' }], next_cursor: '40' };

describe('shared live host projection', () => {
  it('retains opaque connection/channel/group IDs without fabricating a dataset generation', async () => {
    const request = vi.fn(async () => page as unknown as JsonValue);
    const live = new EngineLiveTransport(request, () => '7');
    const channels = await live.page({ limit: 40 });
    expect(channels).toMatchObject({ catalogId: 'opaque-connection', generation: null,
      items: [{ id: 'opaque:m3u/channel', type: 'live', name: 'News' }], nextCursor: '40' });
    const categories = await live.categories();
    expect(categories.items).toEqual([{ id: 'opaque:group', name: 'News' }]);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('uses the same opaque source admission for M3U rather than requiring an IPTV ID prefix', async () => {
    const request = vi.fn(async (_path: string) => ({ streams: [{ id: 'opaque-grant_1', name: 'News', source_addon_id: 'opaque-connection' }] }));
    const live = new EngineLiveTransport(request, () => '7');
    expect(await live.source('opaque:m3u/channel')).toMatchObject({ id: 'opaque-grant_1', sourceAddonId: 'opaque-connection' });
    expect(request.mock.calls[0][0]).toBe('/api/v3/profiles/7/live/opaque%3Am3u%2Fchannel/sources');
  });
  it('does not expose upstream URLs or credentials as a live source grant', async () => {
    const live = new EngineLiveTransport(async () => ({ streams: [{ id: 'grant', url: 'https://private.example/media' }] }), () => '7');
    await expect(live.source('channel')).rejects.toMatchObject({ status: 502 });
  });
  it('rejects an in-flight previous-profile page and unsupported collections', async () => {
    let profile = 'old', finish!: (value: JsonValue) => void;
    const live = new EngineLiveTransport(async () => new Promise(resolve => { finish = resolve; }), () => profile);
    const pending = expect(live.page()).rejects.toMatchObject({ status: 409 });
    profile = 'new'; finish(page as unknown as JsonValue); await pending;
    await expect(live.page({ collection: 'favorites' })).rejects.toMatchObject({ status: 422 });
  });
  it('converts exact epoch milliseconds and rejects substituted guide identities', async () => {
    const live = new EngineLiveTransport(async () => ({ channel_id: 'channel', programs: [
      { title: 'News', start_millis: 1791999999123, end_millis: 1792001799123, description: null },
    ] }), () => '7');
    expect((await live.guide('channel')).programs[0].start).toBe(1791999999.123);
    await expect(live.guide('other')).rejects.toMatchObject({ status: 502 });
  });
  it('rejects late guide and source results after a profile switch', async () => {
    for (const operation of ['guide', 'source'] as const) {
      let profile = 'old', finish!: (value: JsonValue) => void;
      const live = new EngineLiveTransport(async () => new Promise(resolve => { finish = resolve; }), () => profile);
      const pending = expect(live[operation]('channel')).rejects.toMatchObject({ status: 409 });
      profile = 'new'; finish({ channel_id: 'channel', programs: [], streams: [{ id: 'grant' }] });
      await pending;
    }
  });
});
