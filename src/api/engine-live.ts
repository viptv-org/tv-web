import type { LiveGroup, LiveGuide, LivePage } from '../../vendor/engine/wire';
import type { Guide, JsonObject, LiveCatalogCategories, LiveCatalogPage, LiveCatalogQuery, MediaSource } from './types';
import type { EngineRequest } from './engine-bootstrap';
import type { RequestOptions } from './client-shared';
import { params, segment, TvApiError } from './client-shared';
import { numericCursor } from './engine-catalog';
import { engineCard } from './engine-card';

/** Host-issued connection/channel IDs pass unchanged through the existing guide renderer. */
export class EngineLiveTransport {
  private groups?: { profile: string; connection: string | null; values: readonly LiveGroup[]; until: number };
  constructor(private readonly request: EngineRequest, private readonly selectedProfile: () => string) {}
  async page(query: LiveCatalogQuery = {}, options?: RequestOptions): Promise<LiveCatalogPage> {
    if (query.collection) throw new TvApiError(422, 'This live connection does not support channel collections.');
    const profile = this.selectedProfile(), offset = query.cursor == null ? 0 : numericCursor(query.cursor);
    const limit = query.limit ?? 40;
    const value = await this.request(`/api/v3/profiles/${segment(profile)}/live/channels${params({
      connection_id: query.catalogId, group_id: query.categoryId, search: query.search, offset, limit,
    })}`, {}, options) as unknown as LivePage;
    const connection = value.channels[0]?.connection_id ?? query.catalogId ?? value.connections[0]?.id ?? null;
    if (profile !== this.selectedProfile()) throw new TvApiError(409, 'The selected profile changed.');
    this.groups = { profile, connection, values: value.groups, until: Date.now() + 20_000 };
    return { catalogId: connection, generation: null,
      items: value.channels.map(channel => ({ ...engineCard(channel.card), id: channel.id, type: 'live' as const,
        raw: { engine_channel: channel as unknown as JsonObject } })),
      nextCursor: value.next_cursor, previousCursor: offset > 0 ? String(Math.max(0, offset - limit)) : null };
  }
  async categories(query: Pick<LiveCatalogQuery, 'catalogId' | 'cursor' | 'limit' | 'search'> = {}, options?: RequestOptions): Promise<LiveCatalogCategories> {
    const profile = this.selectedProfile();
    if (!this.groups || this.groups.profile !== profile || Date.now() >= this.groups.until
      || query.catalogId != null && this.groups.connection !== query.catalogId)
      await this.page({ catalogId: query.catalogId, limit: 1 }, options);
    const value = this.groups;
    if (!value || profile !== this.selectedProfile()) throw new TvApiError(409, 'The selected profile changed.');
    const values = value.values.filter(group => !query.search || group.label.toLowerCase().includes(query.search.toLowerCase()));
    const offset = query.cursor == null ? 0 : numericCursor(query.cursor), limit = query.limit ?? 200;
    return { catalogId: value.connection, generation: null,
      items: values.slice(offset, offset + limit).map(group => ({ id: group.id, name: group.label })),
      nextCursor: offset + limit < values.length ? String(offset + limit) : null,
      previousCursor: offset > 0 ? String(Math.max(0, offset - limit)) : null };
  }
  async guide(channel: string, options?: RequestOptions): Promise<Guide> {
    const profile = this.selectedProfile();
    const value = await this.request(`/api/v3/profiles/${segment(profile)}/live/${segment(channel)}/guide`, {}, options) as unknown as LiveGuide;
    if (profile !== this.selectedProfile()) throw new TvApiError(409, 'The selected profile changed.');
    if (value.channel_id !== channel) throw new TvApiError(502, 'The server returned a different channel guide.');
    return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      programs: value.programs.map(program => ({ title: program.title, start: program.start_millis / 1000,
        end: program.end_millis / 1000, description: program.description ?? undefined, raw: {} })) };
  }
  async source(channel: string, options?: RequestOptions): Promise<MediaSource> {
    const profile = this.selectedProfile();
    const value = await this.request(`/api/v3/profiles/${segment(profile)}/live/${segment(channel)}/sources`, { method: 'POST', body: {} }, options) as JsonObject;
    if (profile !== this.selectedProfile()) throw new TvApiError(409, 'The selected profile changed.');
    const streams = value.streams;
    if (!Array.isArray(streams) || !streams.length) throw new TvApiError(502, 'No live source is available.');
    const source = streams[0];
    if (!source || typeof source !== 'object' || Array.isArray(source) || typeof source.id !== 'string'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(source.id)
      || ['url', 'headers', 'authorization', 'integration_key', 'gateway_key'].some(key => key in source))
      throw new TvApiError(502, 'The server returned an invalid live source grant.');
    return { id: source.id, name: typeof source.name === 'string' ? source.name : 'Live channel', raw: {},
      sourceAddonId: typeof source.source_addon_id === 'string' ? source.source_addon_id : undefined };
  }
}
