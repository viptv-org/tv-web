import { TvApi } from './client';
import type { Catalog, DiscoverRequest, JsonObject, JsonValue, MediaItem, Page } from './types';
import type { RequestOptions } from './client-shared';
import { params, segment, TvApiError } from './client-shared';
import type { Card, LibrarySnapshot } from '../../vendor/engine/wire';
import { engineCard, itemIdentity, identityKey } from './engine-card';
import { engineCatalog, numericCursor } from './engine-catalog';
import { continuationPage, EngineContinuationTransport } from './engine-continuation';
import { EngineLiveTransport } from './engine-live';

/** Remote TV adapter: the engine host owns providers, identity mapping and viewing policy. */
export class EngineTvApi extends TvApi {
  protected override proxyEngineArtwork() { return true; }
  override get supportsLiveCollections() { return false; }
  override get supportsGlobalSearch() { return true; }
  private subtitleProfile: string | null = null;
  private subtitleSession?: string;
  private subtitleAvailable = false;
  override get supportsProviderSubtitles() { return this.subtitleAvailable && this.subtitleProfile === this.tokens?.profileId && this.subtitleSession === this.tokens?.sessionId; }
  override async bootstrap(options?: RequestOptions) {
    const value = await super.bootstrap(options);
    this.subtitleProfile = value.identity.profile_id == null ? null : String(value.identity.profile_id);
    this.subtitleSession = this.tokens?.sessionId;
    this.subtitleAvailable = value.subtitle_availability?.available === true;
    return value;
  }
  override async providerSubtitles(item: Pick<MediaItem, 'id' | 'type'>, options?: RequestOptions) {
    const profile = this.tokens?.profileId, session = this.tokens?.sessionId;
    const value = await this.raw(`/api/v3/subtitles/${segment(item.type)}/${segment(item.id)}`, {}, true, options) as unknown as import('../../vendor/engine/wire').SubtitleSnapshot;
    if (profile !== this.tokens?.profileId || session !== this.tokens?.sessionId || value.scope.profile_id !== profile)
      throw new TvApiError(409, 'The selected profile changed.');
    return value.candidates;
  }
  override globalSearch(query: string, options?: RequestOptions) { return this.engineCatalog.discover({ type: 'all', search: query }, options); }
  private readonly continuation = new EngineContinuationTransport((path, input, options) => this.raw(path, input, true, options));
  private readonly liveEngine = new EngineLiveTransport((path, input, options) => this.raw(path, input, true, options), () => {
    if (!this.tokens?.profileId) throw new TvApiError(401, 'Choose a profile.');
    return this.tokens.profileId;
  });
  override liveV2(query: import('./types').LiveCatalogQuery = {}, options?: RequestOptions) {
    return this.liveEngine.page(query, options);
  }
  override liveCategoriesV2(query = {}, options?: RequestOptions) { return this.liveEngine.categories(query, options); }
  override guideV2(channel: string, options?: RequestOptions) { return this.liveEngine.guide(channel, options); }
  override liveSourceV2(channel: string, options?: RequestOptions) { return this.liveEngine.source(channel, options); }
  async homeProjection(profile: string, options?: RequestOptions) {
    const value = await this.bootstrap(options);
    if (String(value.identity.profile_id) !== profile) throw new TvApiError(409, 'The selected profile changed.');
    const hero = value.home?.hero ?? value.home?.featured[0];
    return { hero: hero ? engineCard(hero) : undefined, saved: hero ? await this.saved(engineCard(hero), options) : false,
      featured: value.home?.featured.map(card => engineCard(card)) ?? [],
      queue: value.continuation ? continuationPage(value.continuation).items : [],
      favorites: value.library?.cards.slice(0, 12).map(card => engineCard(card)) ?? [] };
  }
  async saved(item: MediaItem, options?: RequestOptions): Promise<boolean> {
    const value = await this.bootstrap(options), identity = itemIdentity(item);
    return value.library_membership?.identities.some(id => identityKey(id) === identityKey(identity))
      ?? value.library?.cards.some(card => identityKey(card.identity) === identityKey(identity)) ?? false;
  }
  override async catalogRevision(options?: RequestOptions): Promise<string> {
    const value = await this.bootstrap(options);
    return `${value.home?.scope.revision ?? 0}-${value.home?.revision ?? 0}`;
  }
  override async catalogs(options?: RequestOptions): Promise<Catalog[]> {
    const value = await this.bootstrap(options);
    return (value.home?.rows ?? []).map(engineCatalog).filter((row): row is Catalog => !!row);
  }
  override discover(input: DiscoverRequest, options?: RequestOptions) { return this.engineCatalog.discover(input, options); }
  override async detail(input: Pick<MediaItem, 'id' | 'type'> & Partial<Pick<MediaItem, 'seriesId'>>,
    options?: RequestOptions & { readonly offset?: number; readonly limit?: number }) {
    if (input.type === 'live') return super.detail(input, options);
    const first = await this.engineCatalog.detail(input, { ...options, limit: options?.limit ?? 128 });
    if (options?.offset != null) return first;
    const episodes = [...first.episodes], seen = new Set(episodes.map(item => item.id));
    let offset = first.nextOffset;
    while (offset != null) {
      if (offset < episodes.length || offset > 100_000) throw new TvApiError(502, 'The server repeated an episode page.');
      const page = await this.engineCatalog.detail(input, { ...options, offset, limit: 128 });
      for (const item of page.episodes) {
        if (!seen.has(item.id)) { seen.add(item.id); episodes.push(item); }
      }
      if (page.nextOffset != null && page.nextOffset <= offset) throw new TvApiError(502, 'The server repeated an episode page.');
      offset = page.nextOffset;
    }
    return { ...first, episodes, nextOffset: null };
  }
  override async sources(item: MediaItem, options?: RequestOptions) {
    const identity = itemIdentity(item);
    const body: Record<string, JsonValue> = { type: identity.kind, id: identity.id };
    const imdb = identity.ids.find(id => id.namespace === 'imdb');
    if (imdb) body.imdb_id = imdb.value;
    if (identity.episode) { body.episode = identity.episode.episode; if (identity.episode.season != null) body.season = identity.episode.season; }
    const value = await this.raw('/api/v2/streams', { method: 'POST', body }, true, options) as JsonObject;
    if (typeof value.id !== 'string') throw new TvApiError(502, 'The server returned an invalid source job.');
    return { id: value.id };
  }
  override async queue(profile: string, offset?: number,
    options?: RequestOptions & { readonly onPage?: (page: Page<MediaItem>) => void }) {
    const value = offset == null ? (await this.bootstrap(options)).continuation : undefined;
    if (value && value.scope.profile_id !== profile) throw new TvApiError(409, 'The selected profile changed.');
    const result = value ? continuationPage(value) : await this.continuation.page(profile, offset, options);
    options?.onPage?.(result);
    return result;
  }
  override nextEpisode(profile: string, item: MediaItem, options?: RequestOptions) { return this.continuation.next(profile, item, options); }
  override async setQueueVisibility(profile: string, item: MediaItem, hidden: boolean, options?: RequestOptions) {
    await this.continuation.visibility(profile, item, hidden, options);
    this.engineBootstrap.invalidate();
  }
  override async favorites(profile: string, options?: RequestOptions): Promise<MediaItem[]> {
    const initial = await this.bootstrap(options);
    if (String(initial.identity.profile_id) !== profile) throw new TvApiError(409, 'The selected profile changed.');
    const cards = [...(initial.library?.cards ?? [])];
    let cursor = initial.library?.next_cursor ?? (initial.library ? null : '0');
    const seen = new Set<string>();
    while (cursor != null) {
      if (seen.has(cursor)) throw new TvApiError(502, 'The server repeated a library page.');
      seen.add(cursor);
      const value = await this.raw(`/api/v3/profiles/${segment(profile)}/library${params({
        offset: numericCursor(cursor), limit: 100 })}`, {}, true, options) as unknown as LibrarySnapshot;
      cards.push(...value.cards); cursor = value.next_cursor;
    }
    return cards.map(card => engineCard(card));
  }
  override async setFavorite(profile: string, item: MediaItem, options?: RequestOptions) {
    const owned = item.raw.engine_card as unknown as Card | undefined;
    const card: Card = owned ?? { identity: itemIdentity(item), title: item.name, provider_id: 'library',
      poster: item.poster ?? null, landscape: item.background ?? null, logo: item.titleLogo ?? null,
      description: item.description ?? null, category: null, metadata: null, subtitle: null,
      progress: null, badges: [], parent_identity: null, added_at_millis: null };
    await this.raw(`/api/v3/profiles/${segment(profile)}/library`, {
      method: 'PUT', body: { card: card as unknown as JsonObject },
    }, true, options);
    this.engineBootstrap.invalidate();
  }
  override async toggleFavorite(profile: string, item: MediaItem, options?: RequestOptions) {
    const identity = itemIdentity(item), saved = await this.saved(item, options);
    if (saved) {
      await this.raw(`/api/v3/profiles/${segment(profile)}/library/${segment(identity.kind)}/${segment(identity.id)}`,
        { method: 'DELETE' }, true, options);
      this.engineBootstrap.invalidate();
    } else await this.setFavorite(profile, item, options);
    return !saved;
  }
}
