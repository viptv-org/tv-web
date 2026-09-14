import { normalizeCore as normalizeRust } from "../core";
import { CoreBridge } from "../../vendor/core/wasm/viptv_core";
import { createCoreDriver } from "../../vendor/core/runtime/driver";
import { createHttpTransport } from "../../vendor/core/runtime/index";
import type { Event, ViewModel } from "../../vendor/core/typescript/wire";
function normalizeCore<T>(kind: string, value: unknown, origin = ""): T {
  try { return normalizeRust<T>(kind, value, origin); }
  catch { throw new TvApiError(200, "Invalid server response", "invalid_response"); }
}
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
  MediaKind,
  MediaSource,
  Page,
  ParentStatus,
  ParentPinChange,
  PlaybackCapabilities,
  PlaybackPreferences,
  PlaybackSession,
  PlaybackStart,
  StreamDiscovery,
  StreamPoll,
  TvApiErrorShape,
  TvIdentity,
  TvProfile,
} from "./types";

export class TvApiError extends Error implements TvApiErrorShape {
  readonly name = "TvApiError";
  constructor(
    readonly status: number,
    readonly message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface DeviceSessionStore {
  load(): Promise<DeviceTokenSet | null>;
  save(tokens: DeviceTokenSet): Promise<void>;
  clear(): Promise<void>;
}
/** Default storage is process memory. The app must explicitly supply durable platform storage. */
export class MemoryDeviceSessionStore implements DeviceSessionStore {
  private value: DeviceTokenSet | null = null;
  async load() {
    return this.value;
  }
  async save(value: DeviceTokenSet) {
    this.value = value;
  }
  async clear() {
    this.value = null;
  }
}
export interface TvApiOptions {
  /** Development-only, same-origin HTTP preview on the trusted LAN. */
  readonly allowInsecurePreview?: boolean;
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly sessionStore?: DeviceSessionStore;
}
export interface RequestOptions {
  readonly signal?: AbortSignal;
}
export class ApiScope {
  private readonly controller = new AbortController();
  get signal() {
    return this.controller.signal;
  }
  request(): RequestOptions {
    return { signal: this.signal };
  }
  abort(reason?: unknown) {
    this.controller.abort(reason);
  }
}

export class TvApi {
  private readonly origin: string;
  private readonly requestFetch: typeof fetch;
  private readonly store: DeviceSessionStore;
  private tokens: DeviceTokenSet | null = null;
  private refreshFlight: Promise<DeviceTokenSet> | null = null;
  private sessionEvent?: (event: Event, options?: RequestOptions) => Promise<ViewModel>;

  constructor(options: TvApiOptions) {
    const url = new URL(options.baseUrl);
    const localPreview = import.meta.env.DEV && options.allowInsecurePreview === true
      && url.protocol === "http:" && url.origin === globalThis.location?.origin;
    if (
      (url.protocol !== "https:" && !localPreview) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error(
        "VIPTV API base URL must be an HTTPS origin without a path",
      );
    this.origin = url.origin;
    // Browser fetch is a Window method and throws "Illegal invocation" when
    // called as a detached function. Injected test/host fetches are already
    // explicit callables and retain their own receiver convention.
    this.requestFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.store = options.sessionStore ?? new MemoryDeviceSessionStore();
  }
  /** Rust owns restoration, refresh, and remembered-profile selection. */
  createSessionDriver(render: (view: ViewModel) => void, onError: (message: string) => void) {
    const core = new CoreBridge();
    let imperative = 0;
    const driver = createCoreDriver({
      core,
      storage: {
        load: async () => {
          this.tokens = await this.store.load();
          return this.tokens ? JSON.stringify(this.tokens) : null;
        },
        save: async (serialized) => {
          await this.saveTokens(JSON.parse(serialized) as DeviceTokenSet);
        },
        clear: async () => { this.tokens = null; await this.store.clear(); },
      },
      http: createHttpTransport({ allowedOrigins: [this.origin], fetch: this.requestFetch, maxResponseBytes: 2 * 1024 * 1024 }),
      render: (view) => { if (!imperative) render(view); },
      onError,
    });
    const run = async (event: Event, options?: RequestOptions): Promise<ViewModel> => {
      options?.signal?.throwIfAborted();
      imperative++;
      const cancel = () => driver.cancelHttp();
      options?.signal?.addEventListener("abort", cancel, { once: true });
      try {
        await driver.dispatch(event);
        await driver.idle();
        options?.signal?.throwIfAborted();
        const view = JSON.parse(core.view()) as ViewModel;
        if (view.phase === "Error") throw new TvApiError(view.errorStatus ?? 0, view.error ?? "Unable to connect");
        return view;
      } finally {
        imperative--;
        options?.signal?.removeEventListener("abort", cancel);
      }
    };
    this.sessionEvent = run;
    return { ...driver, dispose: () => {
      if (this.sessionEvent === run) this.sessionEvent = undefined;
      driver.dispose(); core.free();
    } };
  }
  get serverOrigin() {
    return this.origin;
  }
  createScope() {
    return new ApiScope();
  }
  async restoreSession() {
    this.tokens = await this.store.load();
    return this.tokens;
  }
  async beginPairing(
    deviceName: string,
    options?: RequestOptions,
  ): Promise<DevicePairing> {
    const value = expectObject(
      await this.raw(
        "/api/auth/device/code",
        { method: "POST", body: { device_name: deviceName } },
        false,
        options,
      ),
    );
    return normalizeCore<DevicePairing>("pairing", value);
  }
  async claimPairing(deviceCode: string, options?: RequestOptions) {
    const tokens = await this.deviceTokens("/api/auth/device/token", deviceCode, options);
    if (this.sessionEvent) await this.sessionEvent({ AdoptSession: { tokensJson: JSON.stringify(tokens) } }, options);
    else await this.saveTokens(tokens);
    return tokens;
  }
  async refresh(options?: RequestOptions) {
    return this.refreshTokens(options);
  }
  /**
   * Only discard a locally durable grant after the server has accepted its
   * revocation. A parent-PIN rejection, cancelled scope or transport outage
   * leaves this TV paired so the UI can authenticate and retry the original
   * protected action without forcing a new device-link flow.
   */
  async signOut(options?: RequestOptions) {
    if (this.sessionEvent) { await this.sessionEvent("SignOut", options); return; }
    await this.raw(
      "/api/auth/logout",
      { method: "POST", body: {} },
      true,
      options,
    );
    this.tokens = null;
    await this.store.clear();
  }
  async me(options?: RequestOptions): Promise<TvIdentity> {
    return normalizeCore<TvIdentity>("identity", await this.raw("/api/auth/me", {}, true, options));
  }
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
    return normalizeCore<DiscoverPage>("discoverResponse", { response: v, type: request.type });
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
    const v = expectObject(
      await this.raw(
        "/api/streams",
        { method: "POST", body: itemRequest(item) },
        true,
        options,
      ),
    );
    return { id: idAt(v, "id") };
  }
  async pollSources(
    id: string,
    after = 0,
    options?: RequestOptions,
  ): Promise<StreamPoll> {
    const v = expectObject(
      await this.raw(
        `/api/streams/${segment(id)}${params({ after })}`,
        {},
        true,
        options,
      ),
    );
    return normalizeCore<StreamPoll>("streamPoll", v);
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
    await this.domainRequest({ operation: "saveProgress", profileId, item, position, duration }, options);
  }
  async correctProgress(
    profileId: string,
    item: MediaItem,
    watched: boolean,
    options?: RequestOptions,
  ) {
    await this.domainRequest({ operation: "correctProgress", profileId, item, action: watched ? "watched" : "unwatched", duration: item.duration ?? 0 }, options);
  }
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

  private async domainRequest(input: unknown, options?: RequestOptions): Promise<JsonValue> {
    const request = normalizeCore<{ method: string; path: string; body: JsonObject | null }>("request", input);
    return this.raw(request.path, { method: request.method, body: request.body ?? undefined }, true, options);
  }

  private async deviceTokens(
    path: string,
    token: string,
    options?: RequestOptions,
  ) {
    const v = expectObject(
      await this.raw(
        path,
        {
          method: "POST",
          body: path.endsWith("refresh")
            ? { refresh_token: token }
            : { device_code: token },
        },
        false,
        options,
      ),
    );
    return tokenSet(v);
  }
  private async saveTokens(tokens: DeviceTokenSet) {
    this.tokens = tokens;
    await this.store.save(tokens);
    return tokens;
  }
  private async refreshTokens(
    options?: RequestOptions,
  ): Promise<DeviceTokenSet> {
    if (!this.tokens)
      throw new TvApiError(401, "Pairing required", "unauthorized");
    if (this.sessionEvent) {
      if (!this.refreshFlight) this.refreshFlight = this.sessionEvent("Retry", options).then(() => {
        if (!this.tokens) throw new TvApiError(401, "Pairing required", "unauthorized");
        return this.tokens;
      }).finally(() => { this.refreshFlight = null; });
      return this.refreshFlight;
    }
    if (!this.refreshFlight)
      this.refreshFlight = this.deviceTokens(
        "/api/auth/device/refresh",
        this.tokens.refreshToken,
        options,
      )
        .then((tokens) => this.saveTokens(tokens))
        .catch(async (error: unknown) => {
          if (
            error instanceof TvApiError &&
            (error.status === 401 || error.status === 403)
          ) {
            this.tokens = null;
            await this.store.clear();
          }
          throw error;
        })
        .finally(() => {
          this.refreshFlight = null;
        });
    return this.refreshFlight;
  }
  private async raw(
    path: string,
    init: { method?: string; body?: JsonObject } = {},
    authenticated: boolean,
    options?: RequestOptions,
  ): Promise<JsonValue> {
    const request = async (retry: boolean): Promise<JsonValue> => {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (init.body) headers["Content-Type"] = "application/json";
      if (authenticated && this.tokens)
        headers.Authorization = `Bearer ${this.tokens.accessToken}`;
      let response: Response;
      try {
        response = await this.requestFetch(`${this.origin}${path}`, {
          method: init.method ?? "GET",
          headers,
          body: init.body ? JSON.stringify(init.body) : undefined,
          signal: options?.signal,
        });
      } catch (error) {
        if (isAbort(error)) throw error;
        throw new TvApiError(0, "Network request failed", "network");
      }
      if (response.status === 401 && authenticated && retry) {
        await this.refreshTokens(options);
        return request(false);
      }
      const payload = await safeJson(response);
      if (!response.ok) {
        const error = objectOrEmpty(payload);
        throw new TvApiError(
          response.status,
          clientMessage(response.status),
          optionalString(error, "error_code"),
        );
      }
      return payload;
    };
    return request(true);
  }
}

function safeJson(response: Response): Promise<JsonValue> {
  const length = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 2 * 1024 * 1024)
    return Promise.reject(
      new TvApiError(
        response.status,
        "Server response is too large",
        "response_too_large",
      ),
    );
  return response.text().then((text) => {
    if (text.length > 2 * 1024 * 1024)
      throw new TvApiError(
        response.status,
        "Server response is too large",
        "response_too_large",
      );
    try {
      return text ? (JSON.parse(text) as JsonValue) : {};
    } catch {
      throw new TvApiError(
        response.status,
        "Invalid server response",
        "invalid_response",
      );
    }
  });
}
function clientMessage(status: number) {
  if (status === 401) return "Pairing expired";
  if (status === 403) return "This action is not available for this profile";
  if (status === 404) return "This item is no longer available";
  if (status === 429) return "Please try again shortly";
  return "VIPTV could not complete that request";
}
function isAbort(value: unknown): value is DOMException {
  return value instanceof DOMException && value.name === "AbortError";
}
function tokenSet(v: JsonObject): DeviceTokenSet {
  return normalizeCore("tokens", v);
}
function profile(v: JsonObject): TvProfile {
  return normalizeCore("profile", v);
}


function mediaItem(v: JsonObject): MediaItem {
  return normalizeCore("media", v);
}
function page(v: JsonObject): Page<MediaItem> {
  return normalizeCore("page", v);
}
function playback(v: JsonObject, origin: string): PlaybackSession {
  return normalizeCore("playback", v, origin);
}
function preferences(v: JsonObject): PlaybackPreferences {
  return normalizeCore("preferences", v);
}
function itemRequest(item: MediaItem): JsonObject {
  return normalizeCore("itemRequest", item);
}
/** Server playback URLs are root-relative capabilities. AVPlay requires an absolute HTTPS URL. */


function snakePreferences(v: Partial<PlaybackPreferences>): JsonObject {
  return normalizeCore("preferencesRequest", v);
}
function params(entries: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(entries))
    if (value !== undefined) p.set(key, String(value));
  const text = p.toString();
  return text ? `?${text}` : "";
}
function segment(value: string) {
  return encodeURIComponent(value);
}
function objectOrEmpty(value: JsonValue): JsonObject {
  return isObject(value) ? value : {};
}
function expectObject(value: JsonValue): JsonObject {
  if (isObject(value)) return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
function objectAt(v: JsonObject, key: string) {
  const value = v[key];
  if (value !== undefined && isObject(value)) return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
function hasObject(v: JsonObject, key: string) {
  const value = v[key];
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function arrayValue(value: JsonValue) {
  if (Array.isArray(value)) return value.filter(isObject);
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
function isObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stringAt(v: JsonObject, key: string) {
  const value = v[key];
  if (typeof value === "string" && value.length) return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
function optionalString(v: JsonObject, key: string) {
  const value = v[key];
  return typeof value === "string" ? value : undefined;
}
function idAt(v: JsonObject, key: string) {
  const value = v[key];
  if (typeof value === "string" && value.length) return value;
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
function boolAt(v: JsonObject, key: string) {
  const value = v[key];
  if (typeof value === "boolean") return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
function optionalBool(v: JsonObject, key: string) {
  const value = v[key];
  return typeof value === "boolean" ? value : undefined;
}
function clean(value: JsonObject): JsonObject {
  return normalizeCore("clean", value);
}

function minimalItem(item: Pick<MediaItem, "id" | "type">): MediaItem {
  return {
    id: item.id,
    type: item.type,
    name: "",
    title: "",
    genres: [], episodes: [],
    raw: {},
  };
}
