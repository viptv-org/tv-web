import { expect, it, vi } from 'vitest';
import { EngineTvApi } from '../../src/api/engine-client';
import { discoveryCatalogs } from '../../src/api/engine-discovery';
import type { DiscoveryControls } from '../../src/api/discovery-types';
import type { QueryControl } from '../../vendor/engine/wire';
import { catalogFilters, sameCatalog } from '../../src/ui/catalogFilters';
import { requestForCatalog, selectionLabel } from '../../src/tv-solid/discoveryQuery';

const genre: QueryControl = { id: 'genre', label: 'Genre', kind: 'MultiChoice', required: true,
  choices: [{ value: 'Action', label: 'Action' }, { value: 'Sci-Fi & Fantasy', label: 'Science fiction' }],
  minimum: null, maximum: null, maximum_selections: 2 };
const controls: DiscoveryControls = { provider_id: 'stremio', media_types: ['movie', 'series'],
  controls: [], catalogs: [1, 2].map(id => ({ id: 'top', name: 'Top', type: 'movie',
    connection_id: `stremio:${id}`, connection_name: `Add-on ${id}`, addon_id: id, controls: [genre] })),
  discovery: { availability: 'Available' } };

it('reads host controls and sends one scoped catalog request with arrays in one JSON parameter', async () => {
  const paths: URL[] = [];
  const fetcher = vi.fn(async input => {
    const url = new URL(String(input)); paths.push(url);
    return new Response(JSON.stringify(url.pathname.endsWith('discovery-controls') ? controls :
      { cards: [], complete: false, next_cursor: '96' }), { headers: { 'content-type': 'application/json' } });
  });
  const api = new EngineTvApi({ baseUrl: 'https://fixture.example', fetch: fetcher });
  const catalogs = discoveryCatalogs(await api.discoveryControls('movie'), 'movie');
  expect(paths).toHaveLength(1); expect(paths[0].pathname).toBe('/api/v3/discovery-controls');
  expect(sameCatalog(catalogs[0], catalogs[1])).toBe(false);
  expect(requestForCatalog(catalogs[1], {})).toBeUndefined();
  expect(requestForCatalog(catalogs[1], { genre: ['a', 'b', 'c'] })).toBeUndefined();
  const query = requestForCatalog(catalogs[1], { genre: ['Action', 'Sci-Fi & Fantasy'] })!;
  const page = await api.discover(query);
  await api.discover({ ...query, skip: page.nextSkip });
  expect(paths).toHaveLength(3);
  for (const url of paths.slice(1)) {
    expect(url.searchParams.get('addon_id')).toBe('2');
    expect(url.searchParams.getAll('values')).toHaveLength(1);
    expect(JSON.parse(url.searchParams.get('values')!)).toEqual([{ id: 'genre', values: ['Action', 'Sci-Fi & Fantasy'] }]);
    expect(url.searchParams.has('genre')).toBe(false);
  }
  expect(paths[2].searchParams.get('skip')).toBe('96');
});

it('keeps catalog-less feeds owner-controlled, with scalar compatibility and friendly option labels', () => {
  const single = { ...genre, kind: 'SingleChoice' as const, maximum_selections: 1, required: false,
    choices: [{ value: '1', label: 'Action' }] };
  const feed: DiscoveryControls = { provider_id: 'simkl', media_types: ['movie', 'series'], controls: [single],
    catalogs: [], discovery: { availability: 'Available' } };
  const catalog = discoveryCatalogs(feed, 'movie')[0];
  const filters = catalogFilters(catalog);
  expect(selectionLabel(filters[0], '1')).toBe('Action');
  expect(requestForCatalog(catalog, { genre: '1' })).toMatchObject({ type: 'movie', genre: '1' });
  expect(requestForCatalog(catalog, { genre: '1' })?.catalog).toBeUndefined();
  expect(requestForCatalog(catalog, { genre: '1' })?.values).toEqual([]);
  expect(discoveryCatalogs({ ...feed, discovery: { availability: 'NotSupported' } }, 'movie')).toEqual([]);
});
