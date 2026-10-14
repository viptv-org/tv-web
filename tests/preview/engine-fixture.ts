import type { Card, PlaybackRecord } from '../../vendor/engine/wire';
type Item = Record<string, any>;
export interface EngineFixtureState {
  profile: string | null; queue: Item[]; favorites: Item[]; catalogs: Item[];
  discover: (url: URL) => { metas: Item[] };
  detail: (id: string) => Item | undefined;
}
const scope = (profile: string | null) => ({ connection_id: 'server', account_id: '7', profile_id: profile ?? '', revision: 1 });
export function fixtureCard(item: Item, parent?: Card): Card {
  const episode = typeof item.episode === 'number' ? { order: 'aired', season: item.season ?? null, episode: item.episode } : null;
  return { identity: { id: item.id, kind: parent ? 'series' : item.type === 'episode' ? 'series' : item.type,
    ids: [], episode, edition: null }, parent_identity: parent?.identity ?? (item.series_id ? {
      id: item.series_id, kind: 'series', ids: [], episode: null, edition: null,
    } : null), category: null, provider_id: 'fixture', title: item.name ?? item.title ?? '',
    subtitle: null, description: item.description ?? null, poster: item.poster ?? null,
    landscape: item.thumbnail ?? item.background ?? null, logo: item.logo ?? null, badges: [],
    added_at_millis: null, progress: null, metadata: { year: item.year ?? null,
      runtime_minutes: Number.parseInt(item.runtime) || null, genres: item.genres ?? [],
      rating: Number(item.imdbRating) || null, rating_votes: null, certification: null, alternate_titles: [] } };
}
function fixtureRecord(item: Item): PlaybackRecord {
  const card = fixtureCard(item);
  return { identity: card.identity, parent_identity: card.parent_identity, presentation: card,
    provider_id: 'fixture', title: card.title, poster: card.poster, landscape: card.landscape,
    position_millis: (item.position ?? 0) * 1000, duration_millis: (item.duration ?? 0) * 1000,
    updated_at_millis: 1, completed_at_millis: item.watched ? 1 : null, times_watched: null };
}
function continuation(state: EngineFixtureState) {
  return { scope: scope(state.profile), revision: 1, entries: state.queue.map(item => ({ card: fixtureCard(item),
    record: fixtureRecord(item.previous_episode ?? item), status: item.queue_status === 'next' ? 'Next' : 'Resume',
    previous_identity: item.previous_episode ? fixtureCard(item.previous_episode).identity : null })),
    next_cursor: null, complete: true };
}
/** Wire fixtures match the remote host; this module does not participate in production routing. */
export function engineFixture(url: URL, method: string, body: Item, state: EngineFixtureState): unknown {
  if (url.pathname === '/api/v3/bootstrap') {
    const rows = state.catalogs.filter(catalog => ['movie', 'series', 'anime'].includes(catalog.type)).map(catalog => {
      const query = [{ id: 'type', values: [catalog.type] }, { id: 'catalog', values: [catalog.id] },
        { id: 'addon_id', values: [String(catalog.addon_id)] }];
      const input = new URL(url); query.forEach(value => input.searchParams.set(value.id, value.values[0]));
      return { id: `fixture:${catalog.type}:${catalog.id}`, title: catalog.name, provider_id: `addon:${catalog.addon_id}`,
        state: 'Ready', cards: state.discover(input).metas.map(item => fixtureCard(item)),
        browse: { target: 'Discover', query }, next_cursor: null, message: null };
    });
    return { identity: { profile_id: state.profile, account_id: '7' }, home: {
      scope: scope(state.profile), revision: 1, rows, hero: rows[0]?.cards[0] ?? null,
      featured: rows[0]?.cards.slice(0, 5) ?? [], complete: true },
      continuation: continuation(state), library: { cards: state.favorites.map(item => fixtureCard(item)), next_cursor: null, complete: true },
      library_membership: { identities: state.favorites.map(item => fixtureCard(item).identity), revision: 1, complete: true } };
  }
  if (url.pathname === '/api/v3/discover') return {
    cards: state.discover(url).metas.map(item => fixtureCard(item)), next_cursor: null, complete: true,
  };
  const metadata = /^\/api\/v3\/meta\/[^/]+\/([^/]+)$/.exec(url.pathname);
  if (metadata) {
    const value = state.detail(decodeURIComponent(metadata[1]));
    if (!value) return undefined;
    const parent = fixtureCard(value), videos: Item[] = value.videos ?? [];
    const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 24);
    return { item: parent, episodes: videos.slice(offset, offset + limit).map(item => fixtureCard(item, parent)),
      recommendations: [], seasons: [], next_cursor: offset + limit < videos.length ? String(offset + limit) : null };
  }
  if (/\/api\/v3\/profiles\/[^/]+\/continue$/.test(url.pathname)) return continuation(state);
  if (url.pathname.endsWith('/continue/visibility')) return { ok: true };
  if (url.pathname.endsWith('/continue/next')) {
    const value = state.detail(body.parent_identity?.id ?? '');
    const next = value?.videos?.find((item: Item) => item.season === body.identity?.episode?.season && item.episode === body.identity.episode.episode + 1);
    return { status: next ? 'Next' : 'CaughtUp', item: next ? fixtureCard(next, fixtureCard(value!)) : null };
  }
  if (/\/api\/v3\/profiles\/[^/]+\/library$/.test(url.pathname) && method === 'GET')
    return { cards: state.favorites.map(item => fixtureCard(item)), next_cursor: null, complete: true };
  return undefined;
}
