/* TvApi: playback sessions, queue, favorites and media mutations,
   extending the session/profile/catalog base. The module's public
   surface is re-exported so existing importers are unchanged. */
import { normalizeCore as normalizeRust } from "../core";
import { TvApiError, normalizeResponse, isAbort, mediaItem, preferences, snakePreferences, params, segment, expectObject, objectAt, hasObject, arrayValue, stringAt, boolAt, optionalBool, optionalString, clean } from "./client-shared";
import type { RequestOptions } from "./client-shared";
import type {
  Guide,
  JsonObject,
  JsonValue,
  LiveCatalogQuery,
  LiveCatalogPage,
  LiveCatalogCategories,
  MediaDetail,
  MediaItem,
  ParentStatus,
  ParentPinChange,
  PlaybackPreferences,
  QueuePage,
} from "./types";
import { TvApiCatalog } from "./client-catalog";

/** `/continue` reports its state as typed PascalCase names; the shelf contract
    keeps the historical snake_case wire values it renders and filters on. */
const CONTINUATION_STATUS: Readonly<Record<string, string>> = {
  Resume: "resume",
  Next: "next",
  Pending: "pending",
  CaughtUp: "caught_up",
  Upcoming: "upcoming",
  Unavailable: "unavailable",
};

function numberAt(v: JsonObject, key: string) {
  const value = v[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** The continuation record measures milliseconds; shelf rows are in seconds. */
function seconds(value: JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value / 1000 : undefined;
}

/** Only the identity fields the shelf contract carries; the server owns the rest. */
function identityRow(identity: JsonObject, series?: JsonObject): JsonObject {
  const episode = hasObject(identity, "episode") ? objectAt(identity, "episode") : undefined;
  return {
    id: stringAt(identity, "id"),
    type: stringAt(identity, "kind"),
    series_id: series ? stringAt(series, "id") : undefined,
    season: episode ? numberAt(episode, "season") : undefined,
    episode: episode ? numberAt(episode, "episode") : undefined,
  };
}

/**
 * One continuation entry is a server-rendered card plus the playback record it
 * stands on. The card names the title and its artwork; the record carries the
 * resumable offset. Flattening them here keeps the existing shelf item shape
 * and leaves all validation and scrubbing to the shared Rust `media` contract.
 */
function continuationRow(entry: JsonObject): MediaItem {
  const card = objectAt(entry, "card");
  const record = objectAt(entry, "record");
  const series = hasObject(card, "parent_identity") ? objectAt(card, "parent_identity")
    : hasObject(record, "parent_identity") ? objectAt(record, "parent_identity") : undefined;
  const previous = hasObject(entry, "previous_identity") ? objectAt(entry, "previous_identity") : undefined;
  const status = optionalString(entry, "status");
  return mediaItem({
    ...identityRow(objectAt(card, "identity"), series),
    name: stringAt(card, "title"),
    title: stringAt(card, "title"),
    subtitle: optionalString(card, "subtitle"),
    description: optionalString(card, "description"),
    poster: optionalString(card, "poster"),
    background: optionalString(card, "landscape"),
    title_logo: optionalString(card, "logo"),
    source_addon_id: optionalString(card, "provider_id"),
    position: seconds(record.position_millis),
    duration: seconds(record.duration_millis),
    updated_at: seconds(record.updated_at_millis),
    queue_status: status ? CONTINUATION_STATUS[status] : undefined,
    previous_episode: previous ? {
      ...identityRow(previous, series),
      name: stringAt(card, "title"),
      title: stringAt(card, "title"),
    } : undefined,
  });
}

export class TvApi extends TvApiCatalog {
  /** Continue Watching is a cursor envelope (`entries` + `next_cursor`). */
  async queue(
    profileId: string,
    cursor?: string,
    options?: RequestOptions & { readonly onPage?: (page: QueuePage) => void },
  ): Promise<QueuePage> {
    const scope = new AbortController();
    const cancel = () => scope.abort();
    options?.signal?.addEventListener("abort", cancel, { once: true });
    if (options?.signal?.aborted) scope.abort();
    const ensureActive = () => { if (scope.signal.aborted) throw new DOMException("Request cancelled", "AbortError"); };
    try {
      ensureActive();
      const v = expectObject(await this.raw(
        `/api/profiles/${segment(profileId)}/continue${params({ offset: cursor, limit: 40 })}`,
        {}, true, { signal: scope.signal },
      ));
      const next = v.next_cursor;
      const result: QueuePage = {
        items: arrayValue(v.entries ?? null).map(continuationRow),
        nextCursor: typeof next === "string" && next.length ? next : null,
      };
      options?.onPage?.(result);
      const enriched = [...result.items];
      const metadata = new Map<string, Promise<MediaDetail>>();
      let position = 0;
      const worker = async () => {
        while (position < enriched.length) {
          ensureActive();
          const index = position++, item = enriched[index];
          if (item.type === "live") continue;
          try {
            const key = `${item.type}\0${item.seriesId ?? item.id}`;
            let pending = metadata.get(key);
            if (!pending) { pending = this.detail(item, { signal: scope.signal }); metadata.set(key, pending); }
            const detail = await pending;
            ensureActive();
            enriched[index] = normalizeResponse<MediaItem>("enrichHome", {
              original: item, metadata: { ...detail.item, episodes: detail.episodes },
            });
            options?.onPage?.({ ...result, items: [...enriched] });
          } catch (error) {
            ensureActive();
            if (isAbort(error) || error instanceof TvApiError && [401, 403].includes(error.status)) throw error;
            // Artwork outages retain the original resumable queue row and its exact source.
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, enriched.length) }, worker));
      ensureActive();
      return { ...result, items: enriched };
    } finally {
      options?.signal?.removeEventListener("abort", cancel);
      scope.abort();
    }
  }
  async nextEpisode(
    profileId: string,
    item: MediaItem,
    options?: RequestOptions,
  ) {
    const v = expectObject(
      await this.domainRequest({ operation: "nextEpisode", profileId, item }, options),
    );
    return {
      status: stringAt(v, "status"),
      item: hasObject(v, "item") ? mediaItem(objectAt(v, "item")) : undefined,
    };
  }
  async setQueueVisibility(
    profileId: string,
    item: MediaItem,
    hidden: boolean,
    options?: RequestOptions,
  ) {
    await this.domainRequest({ operation: "setQueueVisibility", profileId, item, hidden }, options);
  }
  async favorites(profileId: string, options?: RequestOptions) {
    return arrayValue(
      await this.raw(
        `/api/profiles/${segment(profileId)}/favorites`,
        {},
        true,
        options,
      ),
    ).map(mediaItem);
  }
  async setFavorite(
    profileId: string,
    item: MediaItem,
    options?: RequestOptions,
  ) {
    await this.domainRequest({ operation: "setFavorite", profileId, item }, options);
  }
  async toggleFavorite(
    profileId: string,
    item: MediaItem,
    options?: RequestOptions,
  ) {
    const v = expectObject(
      await this.domainRequest({ operation: "toggleFavorite", profileId, item }, options),
    );
    return boolAt(v, "saved");
  }
  async liveV2(query: LiveCatalogQuery = {}, options?: RequestOptions): Promise<LiveCatalogPage> {
    const value = await this.liveV2Control({ ...query, operation: "livePageV2" }, options);
    return this.liveV2PageDecode<LiveCatalogPage>("liveCatalogV2", value, query);
  }
  async liveCategoriesV2(query: Pick<LiveCatalogQuery, "catalogId" | "cursor" | "limit" | "search"> = {}, options?: RequestOptions): Promise<LiveCatalogCategories> {
    const value = await this.liveV2Control({ ...query, operation: "liveCategoriesV2" }, options);
    return this.liveV2PageDecode<LiveCatalogCategories>("liveCategoriesV2", value, query);
  }
  async guideV2(channelId: string, options?: RequestOptions): Promise<Guide> {
    const value = await this.liveV2Control({ operation: "liveGuideV2", id: channelId }, options);
    return this.liveV2Decode<Guide>("guide", value);
  }
  private async liveV2Control(input: unknown, options?: RequestOptions): Promise<JsonValue> {
    let request: { method: string; path: string; body: JsonObject | null };
    try { request = normalizeRust("request", input); }
    catch { throw new TvApiError(400, "The live playlist request is invalid. Reload the guide.", "invalid_catalog_query"); }
    return this.raw(request.path, { method: request.method, body: request.body ?? undefined }, true, options);
  }
  private liveV2Decode<T>(kind: string, value: unknown): T {
    try { return normalizeRust<T>(kind, value); }
    catch { throw new TvApiError(502, "The server returned invalid live playlist data. Update the app/server or reload the guide.", "invalid_catalog_response"); }
  }
  private liveV2PageDecode<T extends LiveCatalogPage | LiveCatalogCategories>(kind: string, value: unknown, query: Pick<LiveCatalogQuery, "catalogId" | "limit">): T {
    const result = this.liveV2Decode<T>(kind, value);
    if (result.items.length > (query.limit ?? 50) || query.catalogId !== undefined && result.catalogId !== query.catalogId)
      throw new TvApiError(502, "The server returned the wrong live playlist page. Reload the guide.", "invalid_catalog_response");
    return result;
  }
  async preferences(profileId: string, options?: RequestOptions) {
    return preferences(
      expectObject(
        await this.raw(
          `/api/profiles/${segment(profileId)}/preferences`,
          {},
          true,
          options,
        ),
      ),
    );
  }
  async savePreferences(
    profileId: string,
    values: Partial<PlaybackPreferences>,
    options?: RequestOptions,
  ) {
    return preferences(
      expectObject(
        await this.raw(
          `/api/profiles/${segment(profileId)}/preferences`,
          { method: "PUT", body: snakePreferences(values) },
          true,
          options,
        ),
      ),
    );
  }
  async parentStatus(options?: RequestOptions): Promise<ParentStatus> {
    const v = expectObject(
      await this.raw("/api/parent/status", {}, true, options),
    );
    return {
      configured: optionalBool(v, "pin_configured") ?? false,
      unlocked: optionalBool(v, "unlocked") ?? false,
      restricted: optionalBool(v, "restricted") ?? false,
      raw: clean(v),
    };
  }
  async unlockParent(pin: string, options?: RequestOptions) {
    await this.raw(
      "/api/parent/unlock",
      { method: "POST", body: { pin } },
      true,
      options,
    );
  }
  async setParentPin(change: ParentPinChange, options?: RequestOptions) {
    await this.raw(
      "/api/parent/pin",
      {
        method: "PUT",
        body: { pin: change.pin, current_pin: change.currentPin },
      },
      true,
      options,
    );
  }
  async addons(options?: RequestOptions) {
    // Accounts have few addons; read every bounded cursor page so settings
    // and source labels see them all.
    const addons: JsonObject[] = [];
    let cursor: string | undefined;
    for (let pages = 0; pages < 10; pages++) {
      const v = expectObject(
        await this.raw(`/api/addons${params({ limit: 200, cursor })}`, {}, true, options),
      );
      addons.push(...arrayValue(v.items ?? null).map(clean));
      if (typeof v.next_cursor !== "string" || !v.next_cursor) break;
      cursor = v.next_cursor;
    }
    return addons;
  }
  async addAddon(manifestUrl: string, options?: RequestOptions) {
    return clean(
      expectObject(
        await this.raw(
          "/api/addons",
          { method: "POST", body: { manifest_url: manifestUrl } },
          true,
          options,
        ),
      ),
    );
  }
  async updateAddon(id: string, values: JsonObject, options?: RequestOptions) {
    return clean(
      expectObject(
        await this.raw(
          `/api/addons/${segment(id)}`,
          { method: "PATCH", body: values },
          true,
          options,
        ),
      ),
    );
  }
  async deleteAddon(id: string, options?: RequestOptions) {
    await this.raw(
      `/api/addons/${segment(id)}`,
      { method: "DELETE" },
      true,
      options,
    );
  }

  async home(profileId: string, options?: RequestOptions) {
    const [queue, progress, favorites] = await Promise.all([
      this.queue(profileId, undefined, options),
      this.progress(profileId, options),
      this.favorites(profileId, options),
    ]);
    return {
      continueWatching: queue.items,
      recentlyWatched: progress,
      myList: favorites,
    };
  }
}

export { MemoryDeviceSessionStore, TvApiError } from "./client-shared";
export type { RequestOptions } from "./client-shared";
