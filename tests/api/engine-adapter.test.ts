import { describe, expect, it, vi } from 'vitest';
import { EngineBootstrapCache } from '../../src/api/engine-bootstrap';
import { EngineTvApi } from '../../src/api/engine-client';
import { engineCard } from '../../src/api/engine-card';
import { continuationItem } from '../../src/api/engine-continuation';
import { engineArtwork } from '../../src/api/engine-artwork';
import { artworkUrl } from '../../src/core/presentations';
import type { Card, ContinuationEntry, PlaybackRecord } from '../../vendor/engine/wire';
import type { JsonObject } from '../../src/api/types';
import { MemoryDeviceSessionStore } from '../../src/api';
import { engineSearchRows } from '../../src/tv-solid/engineSearch';
import { deviceTokens, response } from './client-helpers';

const identity = (id: string, episode: number | null = null) => ({ id, kind: 'series', ids: [], edition: null,
  episode: episode == null ? null : { order: 'aired', season: 1, episode } });
const card = (id = 'opaque:parent', episode: number | null = null): Card => ({ identity: identity(id, episode),
  parent_identity: episode == null ? null : identity('opaque:parent'), provider_id: 'simkl', title: id,
  description: 'Host metadata', metadata: null, category: null, subtitle: null, poster: null,
  landscape: null, logo: 'https://images.example/logo.png', progress: null, badges: [], added_at_millis: null });
const record = (item: Card): PlaybackRecord => ({ identity: item.identity, parent_identity: item.parent_identity,
  presentation: item, title: item.title, provider_id: 'simkl', position_millis: 42_000, duration_millis: 100_000,
  updated_at_millis: 1000, completed_at_millis: 1000, poster: null, landscape: null, times_watched: 1 });

describe('server engine TV boundary', () => {
  it('shows provider subtitles only when the selected profile aggregate advertises them', async () => {
    const store = new MemoryDeviceSessionStore(); await store.save({ ...deviceTokens, profileId: '3' });
    const fetcher = vi.fn(async () => response({ identity: { profile_id: '3' }, home: null,
      subtitle_availability: { available: true, provider_count: 1 } }));
    const api = new EngineTvApi({ baseUrl: 'https://fixture.example', fetch: fetcher, sessionStore: store });
    await api.restoreSession(); expect(api.supportsProviderSubtitles).toBe(false);
    await api.bootstrap(); expect(api.supportsProviderSubtitles).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await store.save({ ...deviceTokens, profileId: '4' }); await api.restoreSession();
    expect(api.supportsProviderSubtitles).toBe(false);
  });
  it('searches once across media types and preserves host order within each labeled row', async () => {
    const anime = { ...card('naruto'), category: 'anime' };
    const movie = { ...card('naruto-movie'), identity: { ...identity('naruto-movie'), kind: 'movie' } };
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => response({ cards: [anime, movie, card('series'),
      { ...card('naruto-two'), category: 'anime' }], next_cursor: null, complete: true }));
    const api = new EngineTvApi({ baseUrl: 'https://fixture.example', fetch: fetcher });
    const result = await api.globalSearch('Naruto');
    const rows = engineSearchRows(result.items);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/api/v3/discover');
    expect(url.searchParams.get('type')).toBe('all');
    expect(url.searchParams.get('search')).toBe('Naruto');
    expect(rows.map(row => [row.id, row.name, row.items.map(item => item.id)])).toEqual([
      ['metadata:anime', 'Anime', ['naruto', 'naruto-two']],
      ['metadata:movie', 'Movies', ['naruto-movie']],
      ['metadata:series', 'TV Shows', ['series']],
    ]);
  });
  it('resolves public image descriptors to the selected server without sending them to an external resizer', () => {
    const path = '/api/v3/images/simkl/posters/abc_m.webp';
    const value = engineArtwork({ poster: path, nested: { landscape: path }, logo: 'https://images.example/logo.png' }, 'https://fixture.example');
    expect(value).toEqual({ poster: `https://fixture.example${path}`, nested: { landscape: `https://fixture.example${path}` }, logo: 'https://images.example/logo.png' });
    expect(artworkUrl(`https://fixture.example${path}`, 320, 180)).toBe(`https://fixture.example${path}`);
  });
  it('shares one aggregate while cancelling one consumer without aborting the others', async () => {
    let finish!: (value: JsonObject) => void;
    const request = vi.fn((_path, _input, options) => new Promise<JsonObject>(resolve => {
      expect(options.signal.aborted).toBe(false); finish = resolve;
    }));
    const cache = new EngineBootstrapCache(request), scope = new AbortController();
    const cancelled = expect(cache.get({ signal: scope.signal })).rejects.toMatchObject({ name: 'AbortError' });
    const retained = cache.get(); scope.abort(); finish({ identity: { profile_id: '3' }, home: null });
    await cancelled; await retained; await cache.get(); expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects a late previous-profile aggregate even if its transport ignores abort', async () => {
    const releases: ((value: JsonObject) => void)[] = [];
    const cache = new EngineBootstrapCache(async () => new Promise<JsonObject>(resolve => releases.push(resolve)));
    const old = expect(cache.get()).rejects.toMatchObject({ name: 'AbortError' });
    cache.invalidate(); const fresh = cache.get();
    releases[0]({ identity: { profile_id: 'old' }, home: null });
    releases[1]({ identity: { profile_id: 'new' }, home: null });
    await old; expect((await fresh).identity.profile_id).toBe('new');
    expect((await cache.get()).identity.profile_id).toBe('new');
  });
  it('keeps the previous completion as history without applying it to the next episode', () => {
    const previous = record(card('opaque:episode-one', 1));
    const entry: ContinuationEntry = { card: card('opaque:episode-two', 2), record: previous,
      status: 'Next', previous_identity: previous.identity };
    expect(continuationItem(entry)).toMatchObject({ id: 'opaque:episode-two', queueStatus: 'next',
      previousEpisode: { id: 'opaque:episode-one', position: 42 } });
    expect(continuationItem(entry).position).toBeUndefined();
    expect(engineCard(entry.card, previous).position).toBeUndefined();
  });
  it('uses explicit host shelf actions and needs one request for startup catalog and queue data', async () => {
    const store = new MemoryDeviceSessionStore(); await store.save({ ...deviceTokens, profileId: '3' });
    const fetcher = vi.fn(async () => response({ identity: { profile_id: '3' }, home: { revision: 8, scope: { revision: 2 },
      rows: [{ id: 'opaque-row-do-not-parse', title: 'Trending', provider_id: 'simkl', state: 'Ready', cards: [card()],
        browse: { target: 'Discover', query: [{ id: 'type', values: ['series'] }, { id: 'catalog', values: ['simkl-trending'] }] } }] },
      continuation: { scope: { profile_id: '3' }, entries: [], complete: true, next_cursor: null } }));
    const api = new EngineTvApi({ baseUrl: 'https://fixture.example', fetch: fetcher, sessionStore: store });
    await api.restoreSession();
    const [revision, catalogs, queue] = await Promise.all([api.catalogRevision(), api.catalogs(), api.queue('3')]);
    expect(revision).toBe('2-8'); expect(catalogs[0]).toMatchObject({ id: 'simkl-trending', type: 'series' });
    expect(queue.items).toEqual([]); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('automatically reads large episode pages while preserving opaque identities and logos', async () => {
    const paths: URL[] = [];
    const api = new EngineTvApi({ baseUrl: 'https://fixture.example', fetch: async input => {
      const url = new URL(String(input)); paths.push(url); const offset = Number(url.searchParams.get('offset') ?? 0);
      return response({ item: card(), seasons: [], recommendations: [card('related')],
        episodes: Array.from({ length: offset ? 3 : 128 }, (_, i) => card(`opaque:episode/${offset + i}`, offset + i + 1)),
        next_cursor: offset ? null : '128' });
    } });
    const detail = await api.detail({ id: 'opaque:parent', type: 'series' });
    expect(detail.episodes).toHaveLength(131); expect(detail.item.titleLogo).toContain('logo.png');
    expect(paths).toHaveLength(2); expect(paths[1].searchParams.get('offset')).toBe('128');
    expect(paths[0].pathname).toContain('opaque%3Aparent');
  });
  it('knows saved membership beyond the bounded Home shelf without hydrating more cards', async () => {
    const selected = card('saved-outside-home');
    const fetcher = vi.fn(async () => response({ identity: { profile_id: '3' }, home: null,
      library: { cards: [], complete: false, next_cursor: '100' },
      library_membership: { identities: [selected.identity], revision: 1, complete: true } }));
    const api = new EngineTvApi({ baseUrl: 'https://fixture.example', fetch: fetcher });
    expect(await api.saved(engineCard(selected))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
