import type { CatalogPage, DetailSnapshot, HomeRow } from '../../vendor/engine/wire';
import type { Catalog, DiscoverPage, DiscoverRequest, JsonObject, MediaDetail, MediaItem } from './types';
import type { RequestOptions } from './client-shared';
import { params, segment, TvApiError } from './client-shared';
import { engineCard } from './engine-card';
import type { EngineRequest } from './engine-bootstrap';

/** Project host actions into the existing shelf UI without interpreting opaque row IDs. */
export function engineCatalog(row: HomeRow): Catalog | undefined {
  if (row.browse?.target !== 'Discover') return undefined;
  const query = Object.fromEntries(row.browse.query.map(value => [value.id, value.values]));
  const type = query.type?.[0];
  if (!type) return undefined;
  return { id: query.catalog?.[0] ?? row.id, name: row.title, type,
    addonKey: row.provider_id, addonId: query.addon_id?.[0] == null ? undefined : numericCursor(query.addon_id[0]),
    supportsSearch: true, supportsSkip: true, extras: [], genres: [],
    raw: { engine_row: row as unknown as JsonObject } };
}

export function engineRow(catalog: Catalog): HomeRow | undefined {
  return catalog.raw.engine_row as unknown as HomeRow | undefined;
}

export class EngineCatalogTransport {
  constructor(private readonly request: EngineRequest) {}
  async discover(input: DiscoverRequest, options?: RequestOptions): Promise<DiscoverPage> {
    const value = await this.request(`/api/v3/discover${params({ type: input.type,
      catalog: input.catalog, addon_id: input.addonId, skip: input.skip, search: input.search,
      genre: input.genre, extras: input.extras ? JSON.stringify(input.extras) : undefined })}`, {}, options) as unknown as CatalogPage;
    return { items: value.cards.map(card => engineCard(card)), hasMore: value.next_cursor != null,
      nextSkip: value.next_cursor == null ? undefined : numericCursor(value.next_cursor) };
  }
  async detail(input: Pick<MediaItem, 'id' | 'type'> & Partial<Pick<MediaItem, 'seriesId'>>,
    options?: RequestOptions & { readonly offset?: number; readonly limit?: number }): Promise<MediaDetail> {
    const id = input.seriesId ?? input.id;
    const value = await this.request(`/api/v3/meta/${segment(input.type)}/${segment(id)}${params({
      offset: options?.offset, limit: options?.limit })}`, {}, options) as unknown as DetailSnapshot;
    return { item: engineCard(value.item), episodes: value.episodes.map(card => engineCard(card)),
      recommendations: value.recommendations.map(card => engineCard(card)),
      seasons: value.seasons, nextOffset: value.next_cursor == null ? null : numericCursor(value.next_cursor) };
  }
}

export function numericCursor(cursor: string): number {
  if (!/^\d{1,6}$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))
    throw new TvApiError(502, 'The server returned an invalid page cursor.');
  return Number(cursor);
}
