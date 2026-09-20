/* TvApi: playback sessions, queue, favorites and media mutations,
   extending the session/profile/catalog base. The module's public
   surface is re-exported so existing importers are unchanged. */
import { normalizeCore as normalizeRust } from "../core";
import { CoreBridge } from "../../vendor/core/wasm/viptv_core";
import { createCoreDriver } from "../../vendor/core/runtime/driver";
import { createHttpTransport } from "../../vendor/core/runtime/index";
import type { Event, ViewModel } from "../../vendor/core/typescript/wire";
import { ApiScope, MemoryDeviceSessionStore, TvApiError, normalizeCore, safeJson, clientMessage, isAbort, tokenSet, profile, mediaItem, page, playback, preferences, itemRequest, snakePreferences, params, segment, objectOrEmpty, expectObject, objectAt, hasObject, arrayValue, isObject, stringAt, optionalString, idAt, boolAt, optionalBool, clean, minimalItem } from "./client-shared";
import type { DeviceSessionStore, RequestOptions, TvApiOptions } from "./client-shared";
import type {
  Catalog,
  DevicePairing,
  DeviceTokenSet,
  DiscoverPage,
  DiscoverRequest,
  Guide,
  JsonObject,
  JsonValue,
  LiveCategories,
  LivePage,
  MediaDetail,
  MediaItem,
  Page,
  ParentStatus,
  ParentPinChange,
  PlaybackPreferences,
  PlaybackSession,
  PlaybackStart,
  StreamDiscovery,
  StreamPoll,
  TvApiErrorShape,
  TvIdentity,
  TvProfile,
} from "./types";
import { TvApiCatalog } from "./client-catalog";

export class TvApi extends TvApiCatalog {
  async queue(
    profileId: string,
    offset?: number,
    options?: RequestOptions,
  ): Promise<Page<MediaItem>> {
    const scope = new AbortController();
    const cancel = () => scope.abort();
    options?.signal?.addEventListener("abort", cancel, { once: true });
    if (options?.signal?.aborted) scope.abort();
    const ensureActive = () => { if (scope.signal.aborted) throw new DOMException("Request cancelled", "AbortError"); };
    try {
      ensureActive();
      const v = expectObject(await this.raw(
        `/api/profiles/${segment(profileId)}/continue/page${params({ offset })}`,
        {}, true, { signal: scope.signal },
      ));
      const result = page(v);
      const enriched = [...result.items];
      const metadata = new Map<string, Promise<MediaDetail>>();
      let cursor = 0;
      const worker = async () => {
        while (cursor < enriched.length) {
          ensureActive();
          const index = cursor++, item = enriched[index];
          if (item.type === "live") continue;
          try {
            const key = `${item.type}\0${item.seriesId ?? item.id}`;
            let pending = metadata.get(key);
            if (!pending) { pending = this.detail(item, { signal: scope.signal }); metadata.set(key, pending); }
            const detail = await pending;
            ensureActive();
            enriched[index] = normalizeCore<MediaItem>("enrichHome", {
              original: item, metadata: { ...detail.item, episodes: detail.episodes },
            });
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
  async queueSettings(profileId: string, options?: RequestOptions) {
    const v = expectObject(
      await this.raw(
        `/api/profiles/${segment(profileId)}/continue/settings`,
        {},
        true,
        options,
      ),
    );
    return { autoplay: boolAt(v, "autoplay") };
  }
  async saveQueueSettings(
    profileId: string,
    autoplay: boolean,
    options?: RequestOptions,
  ) {
    const v = expectObject(
      await this.raw(
        `/api/profiles/${segment(profileId)}/continue/settings`,
        { method: "PUT", body: { autoplay } },
        true,
        options,
      ),
    );
    return { autoplay: boolAt(v, "autoplay") };
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
  async live(
    query: {
      view?: "us";
      collection?: string;
      category?: string;
      search?: string;
      offset?: number;
      limit?: number;
    },
    options?: RequestOptions,
  ): Promise<LivePage> {
    const v = expectObject(
      await this.raw(`/api/live${params(query)}`, {}, true, options),
    );
    return normalizeCore<LivePage>("live", v);
  }
  async liveCategories(
    view?: "us",
    options?: RequestOptions,
  ): Promise<LiveCategories> {
    const v = expectObject(
      await this.raw(
        `/api/live/categories${params({ view })}`,
        {},
        true,
        options,
      ),
    );
    return normalizeCore<LiveCategories>("liveCategories", v);
  }
  async guide(channelId: string, options?: RequestOptions): Promise<Guide> {
    const v = expectObject(
      await this.raw(`/api/guide/${segment(channelId)}`, {}, true, options),
    );
    return normalizeCore<Guide>("guide", v);
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
    return arrayValue(await this.raw("/api/addons", {}, true, options)).map(
      clean,
    );
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

export { ApiScope, MemoryDeviceSessionStore, TvApiError, normalizeCore } from "./client-shared";
export type { DeviceSessionStore, RequestOptions, TvApiOptions } from "./client-shared";
