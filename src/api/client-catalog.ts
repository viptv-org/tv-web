/* TvApiClientBase: constructor, fields, session driver, device pairing,
   profiles and the catalog/detail/source request surface. */
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
  SourcesPollState,
  SourcesPollStep,
  TvApiErrorShape,
  TvIdentity,
  TvProfile,
} from "./types";

import { TvApiClientBase } from "./client-base";

export class TvApiCatalog extends TvApiClientBase {
  async selectProfile(profileId: string, options?: RequestOptions) {
    if (this.sessionEvent) {
      const view = await this.sessionEvent({ SelectProfile: { profileId } }, options);
      if (view.phase !== "Ready" || view.selectedProfileId !== profileId) throw new TvApiError(401, "Pairing required", "unauthorized");
      return;
    }
    await this.raw(
      "/api/auth/profile",
      { method: "POST", body: { profile_id: profileId } },
      true,
      options,
    );
    this.tokens = this.tokens ? { ...this.tokens, profileId } : null;
    if (this.tokens) await this.store.save(this.tokens);
  }
  async profiles(options?: RequestOptions) {
    if (this.sessionEvent) {
      const view = await this.sessionEvent("Retry", options);
      if (view.identity) return view.identity.profiles;
      throw new TvApiError(401, "Pairing required", "unauthorized");
    }
    return arrayValue(await this.raw("/api/profiles", {}, true, options)).map(
      profile,
    );
  }
  async createProfile(input: JsonObject, options?: RequestOptions) {
    return profile(
      expectObject(
        await this.raw(
          "/api/profiles",
          { method: "POST", body: input },
          true,
          options,
        ),
      ),
    );
  }
  async updateProfile(id: string, input: JsonObject, options?: RequestOptions) {
    return profile(
      expectObject(
        await this.raw(
          `/api/profiles/${segment(id)}`,
          { method: "PATCH", body: input },
          true,
          options,
        ),
      ),
    );
  }
  async deleteProfile(id: string, options?: RequestOptions) {
    await this.raw(
      `/api/profiles/${segment(id)}`,
      { method: "DELETE" },
      true,
      options,
    );
  }
  async catalogs(options?: RequestOptions) {
    return normalizeCore<Catalog[]>("catalogs", await this.raw("/api/catalogs", {}, true, options));
  }
  async discover(
    request: DiscoverRequest,
    options?: RequestOptions,
  ): Promise<DiscoverPage> {
    const query = params({
      type: request.type,
      catalog: request.catalog,
      addon_id: request.addonId,
      skip: request.skip,
      search: request.search,
      genre: request.genre,
      extras: request.extras ? JSON.stringify(request.extras) : undefined,
    });
    const v = expectObject(
      await this.raw(`/api/discover${query}`, {}, true, options),
    );
    const page = normalizeCore<DiscoverPage>("discoverResponse", { response: v, type: request.type });
    if (!page.items.length && page.unsupportedCount) {
      throw new TvApiError(200, "This catalog returned a media type this app does not support.", "unsupported_media_type");
    }
    return page;
  }
  async detail(
    item: Pick<MediaItem, "id" | "type"> &
      Partial<Pick<MediaItem, "seriesId">>,
    options?: RequestOptions,
  ): Promise<MediaDetail> {
    const request = normalizeCore<{ path: string }>("request", {
      operation: "metadata",
      item,
    });
    if (item.type === "live") return { item: minimalItem(item), episodes: [] };
    const envelope = expectObject(
      await this.raw(
        request.path,
        {},
        true,
        options,
      ),
    );
    return normalizeCore<MediaDetail>("detailResponse", {
      response: envelope,
      item,
    });
  }

  async sources(
    item: MediaItem,
    options?: RequestOptions,
  ): Promise<StreamDiscovery> {
    const request = normalizeCore<{ method: string; path: string; body: unknown }>(
      "request",
      { operation: "sources", item },
    );
    const v = expectObject(
      await this.raw(
        request.path,
        { method: request.method, body: request.body as JsonObject },
        true,
        options,
      ),
    );
    return { id: idAt(v, "id") };
  }
  /**
   * One polling step of stream discovery. Both the poll path (with its
   * cursor) and the cursor/dedup/budget/completion policy come from the
   * shared Rust core; the caller supplies its accumulated state and
   * transports one page at a time.
   */
  async pollSourcesStep(
    id: string,
    state: SourcesPollState,
    options?: RequestOptions,
  ): Promise<SourcesPollStep> {
    const request = normalizeCore<{ method: string; path: string }>(
      "request",
      { operation: "sourcesPoll", id, after: state.after },
    );
    const v = expectObject(
      await this.raw(request.path, {}, true, options),
    );
    return normalizeCore<SourcesPollStep>("sourcesPollStep", { state, poll: v });
  }
  async startPlayback(
    request: PlaybackStart,
    options?: RequestOptions,
  ): Promise<PlaybackSession> {
    const v = expectObject(
      await this.domainRequest({ operation: "playback", playback: request }, options),
    );
    return playback(v, this.origin);
  }
  async heartbeat(id: string, options?: RequestOptions) {
    await this.raw(
      `/api/playback/${segment(id)}/heartbeat`,
      { method: "POST", body: {} },
      true,
      options,
    );
  }
  async stopPlayback(id: string, options?: RequestOptions) {
    await this.raw(
      `/api/playback/${segment(id)}`,
      { method: "DELETE" },
      true,
      options,
    );
  }
  /** There is no separate seek route: restart the selected opaque stream at `position`. */
  async seek(
    request: PlaybackStart & { readonly position: number },
    options?: RequestOptions,
  ) {
    return this.startPlayback(request, options);
  }
  /** Track selection is applied at playback start; server transcodes/remuxes a new safe session. */
  async startWithTracks(
    request: PlaybackStart & {
      readonly audioTrackIndex?: number;
      readonly subtitleTrackIndex?: number;
      readonly subtitlesOff?: boolean;
    },
    options?: RequestOptions,
  ) {
    return this.startPlayback(request, options);
  }
  async progress(profileId: string, options?: RequestOptions) {
    return arrayValue(
      await this.raw(
        `/api/profiles/${segment(profileId)}/progress`,
        {},
        true,
        options,
      ),
    ).map(mediaItem);
  }
  async seriesProgress(
    profileId: string,
    seriesId: string,
    options?: RequestOptions,
  ): Promise<readonly MediaItem[]> {
    return arrayValue(
      await this.raw(
        `/api/profiles/${segment(profileId)}/progress/series${params({ series_id: seriesId })}`,
        {},
        true,
        options,
      ),
    ).map(mediaItem);
  }
  async saveProgress(
    profileId: string,
    item: MediaItem,
    position: number,
    duration: number,
    options?: RequestOptions,
  ) {
    if (!Number.isFinite(position) || !Number.isFinite(duration)) return;
    await this.domainRequest({ operation: "saveProgress", profileId, item, position: Math.max(0, position), duration: Math.max(0, duration) }, options);
  }
  async correctProgress(
    profileId: string,
    item: MediaItem,
    watched: boolean,
    options?: RequestOptions,
  ) {
    await this.domainRequest({ operation: "correctProgress", profileId, item, action: watched ? "watched" : "unwatched", duration: item.duration ?? 0 }, options);
  }
}
