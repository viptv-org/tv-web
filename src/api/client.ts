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
    return {
      deviceCode: stringAt(value, "device_code"),
      userCode: stringAt(value, "user_code"),
      verificationUri: stringAt(value, "verification_uri"),
      verificationUriComplete: stringAt(value, "verification_uri_complete"),
      qrUri: stringAt(value, "qr_uri"),
      expiresIn: numberAt(value, "expires_in"),
      intervalSeconds: numberAt(value, "interval"),
    };
  }
  async claimPairing(deviceCode: string, options?: RequestOptions) {
    return this.saveTokens(
      await this.deviceTokens("/api/auth/device/token", deviceCode, options),
    );
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
    const v = expectObject(await this.raw("/api/auth/me", {}, true, options));
    const account = objectAt(v, "account");
    return {
      account: {
        id: idAt(account, "id"),
        username: stringAt(account, "username"),
        name: stringAt(account, "name"),
        role: stringAt(account, "role"),
      },
      profiles: arrayAt(v, "profiles").map(profile),
      profileId: optionalId(v, "profile_id") ?? null,
      restricted: boolAt(v, "restricted"),
      profileSetupRequired: boolAt(v, "profile_setup_required"),
    };
  }
  async selectProfile(profileId: string, options?: RequestOptions) {
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
    return arrayValue(await this.raw("/api/catalogs", {}, true, options)).map(
      catalog,
    );
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
    return {
      items: arrayAt(v, "metas").map(mediaItem),
      hasMore: optionalBool(v, "has_more") ?? false,
      nextSkip: optionalNumber(v, "next_skip"),
    };
  }
  async detail(
    item: Pick<MediaItem, "id" | "type">,
    options?: RequestOptions,
  ): Promise<MediaDetail> {
    if (item.type === "live") return { item: minimalItem(item), episodes: [] };
    const envelope = expectObject(
      await this.raw(
        `/api/meta/${item.type}/${segment(item.id)}`,
        {},
        true,
        options,
      ),
    );
    const rawMeta = objectAt(envelope, "meta");
    const meta = mediaItem({
      ...rawMeta,
      type: optionalString(rawMeta, "type") ?? item.type,
    });
    const episodes = rawArray(rawMeta, "videos")
      .filter(isObject)
      .map((episode) =>
        mediaItem({
          ...episode,
          background:
            optionalString(episode, "thumbnail") ??
            optionalString(episode, "image") ??
            optionalString(episode, "background"),
          type: "series",
          series_id: optionalString(episode, "series_id") ?? item.id,
        }),
      );
    return { item: meta, episodes };
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
    return {
      events: arrayAt(v, "events").map((event) => ({
        sequence: numberAt(event, "seq"),
        source: stringAt(event, "source"),
        sources: arrayAt(event, "streams").map(mediaSource),
        error: optionalString(event, "error")
          ? "Source unavailable"
          : undefined,
      })),
      done: boolAt(v, "done"),
    };
  }
  async startPlayback(
    request: PlaybackStart,
    options?: RequestOptions,
  ): Promise<PlaybackSession> {
    const v = expectObject(
      await this.raw(
        "/api/playback",
        { method: "POST", body: snakePlayback(request) },
        true,
        options,
      ),
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
    await this.raw(
      `/api/profiles/${segment(profileId)}/progress`,
      { method: "PUT", body: { ...itemRequest(item), position, duration } },
      true,
      options,
    );
  }
  async correctProgress(
    profileId: string,
    item: MediaItem,
    watched: boolean,
    options?: RequestOptions,
  ) {
    await this.raw(
      `/api/profiles/${segment(profileId)}/progress/correct`,
      {
        method: "PUT",
        body: {
          ...itemRequest(item),
          action: watched ? "watched" : "unwatched",
          duration: item.duration ?? 0,
        },
      },
      true,
      options,
    );
  }
  async queue(
    profileId: string,
    offset?: number,
    options?: RequestOptions,
  ): Promise<Page<MediaItem>> {
    const v = expectObject(
      await this.raw(
        `/api/profiles/${segment(profileId)}/continue/page${params({ offset })}`,
        {},
        true,
        options,
      ),
    );
    return page(v);
  }
  async nextEpisode(
    profileId: string,
    item: MediaItem,
    options?: RequestOptions,
  ) {
    const v = expectObject(
      await this.raw(
        `/api/profiles/${segment(profileId)}/continue/next`,
        { method: "POST", body: itemRequest(item) },
        true,
        options,
      ),
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
    await this.raw(
      `/api/profiles/${segment(profileId)}/continue/visibility`,
      { method: "PUT", body: { ...itemRequest(item), hidden } },
      true,
      options,
    );
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
    await this.raw(
      `/api/profiles/${segment(profileId)}/favorites`,
      { method: "PUT", body: itemRequest(item) },
      true,
      options,
    );
  }
  async toggleFavorite(
    profileId: string,
    item: MediaItem,
    options?: RequestOptions,
  ) {
    const v = expectObject(
      await this.raw(
        `/api/profiles/${segment(profileId)}/favorites/toggle`,
        { method: "POST", body: itemRequest(item) },
        true,
        options,
      ),
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
    return {
      channels: arrayAt(v, "channels").map(mediaItem),
      total: numberAt(v, "total"),
    };
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
    return {
      categories: arrayAt(v, "categories").map(liveCategory),
      total: numberAt(v, "total"),
    };
  }
  async guide(channelId: string, options?: RequestOptions): Promise<Guide> {
    const v = expectObject(
      await this.raw(`/api/guide/${segment(channelId)}`, {}, true, options),
    );
    return {
      timezone: optionalString(v, "timezone") ?? "",
      timeline: (Array.isArray(v.timeline) ? arrayAt(v, "timeline") : []).map(
        (t) => ({
          time: numberAt(t, "start"),
          displayTime: optionalString(t, "display_time") ?? "",
        }),
      ),
      programs: arrayAt(v, "programs").map((p) => ({
        title: optionalString(p, "title") ?? "Untitled",
        start: numberAt(p, "start"),
        end: numberAt(p, "end"),
        description: optionalString(p, "description"),
        raw: clean(p),
      })),
    };
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
  return {
    sessionId: idAt(v, "session_id"),
    accountId: idAt(v, "account_id"),
    profileId: optionalId(v, "profile_id") ?? null,
    accessToken: stringAt(v, "access_token"),
    refreshToken: stringAt(v, "refresh_token"),
    expiresIn: numberAt(v, "expires_in"),
  };
}
function profile(v: JsonObject): TvProfile {
  return {
    id: idAt(v, "id"),
    name: stringAt(v, "name"),
    avatar: optionalString(v, "avatar") ?? optionalString(v, "avatar_url"),
    kid:
      optionalBool(v, "kids") ??
      optionalBool(v, "kid") ??
      optionalBool(v, "is_kids"),
    setupComplete:
      optionalBool(v, "setup_complete") ??
      optionalBool(v, "presentation_complete"),
    raw: clean(v),
  };
}
function catalog(v: JsonObject): Catalog {
  return {
    id: stringAt(v, "id"),
    name: stringAt(v, "name"),
    type: mediaKind(optionalString(v, "type") ?? "movie"),
    addonId: optionalNumber(v, "addon_id"),
    supportsSearch: optionalBool(v, "supports_search") ?? false,
    supportsSkip: optionalBool(v, "supports_skip") ?? false,
    extras: rawArray(v, "extra").filter(isObject).flatMap(catalogExtra),
    genres: strings(v, "genres"),
    raw: clean(v),
  };
}
function catalogExtra(v: JsonObject) {
  const name = optionalString(v, "name");
  return name
    ? [
        {
          name,
          required: optionalBool(v, "is_required") ?? false,
          options: strings(v, "options"),
          defaultValue: optionalString(v, "default"),
          optionsLimit: optionalNumber(v, "options_limit"),
        },
      ]
    : [];
}
function mediaItem(v: JsonObject): MediaItem {
  const previous = hasObject(v, "previous_episode")
    ? mediaItem(objectAt(v, "previous_episode"))
    : undefined;
  return {
    id: stringAt(v, "id"),
    type: mediaKind(stringAt(v, "type")),
    name: optionalString(v, "name") ?? optionalString(v, "title") ?? "Untitled",
    title:
      optionalString(v, "title") ?? optionalString(v, "name") ?? "Untitled",
    poster: optionalString(v, "poster"),
    background:
      optionalString(v, "background") ?? optionalString(v, "backdrop"),
    description:
      optionalString(v, "description") ?? optionalString(v, "overview"),
    year: optionalNumber(v, "year"),
    runtime: optionalString(v, "runtime"),
    genres: rawArray(v, "genres").flatMap((x) =>
      typeof x === "string" ? [x] : [],
    ),
    position: optionalNumber(v, "position"),
    duration: optionalNumber(v, "duration"),
    watched: optionalBool(v, "watched"),
    season: optionalNumber(v, "season"),
    episode: optionalNumber(v, "episode"),
    episodeTitle:
      optionalString(v, "episodeTitle") ?? optionalString(v, "episode_title"),
    seriesId: optionalString(v, "series_id"),
    queueStatus: optionalString(v, "queue_status"),
    previousEpisode: previous,
    sourceAddonId: optionalString(v, "source_addon_id"),
    sourceName: optionalString(v, "source_name"),
    sourceFingerprint: optionalString(v, "source_fingerprint"),
    sourceBingeGroup: optionalString(v, "source_binge_group"),
    sourceReleaseGroup: optionalString(v, "source_release_group"),
    sourceQuality: optionalString(v, "source_quality"),
    sourceAudio: optionalString(v, "source_audio"),
    raw: clean(v),
  };
}
function mediaSource(v: JsonObject): MediaSource {
  return {
    id: stringAt(v, "id"),
    name: optionalString(v, "name") ?? optionalString(v, "title") ?? "Source",
    title: optionalString(v, "title"),
    filename: optionalString(v, "filename"),
    sourceAddonId: optionalString(v, "source_addon_id"),
    sourceName: optionalString(v, "source_name"),
    quality:
      optionalString(v, "source_quality") ?? optionalString(v, "quality"),
    audio: optionalString(v, "source_audio"),
    raw: clean(v),
  };
}
function page(v: JsonObject): Page<MediaItem> {
  return {
    items: arrayAt(v, "items").map(mediaItem),
    offset: numberAt(v, "offset"),
    total: numberAt(v, "total"),
    nextOffset: optionalNumber(v, "next_offset") ?? null,
  };
}
function playback(v: JsonObject, origin: string): PlaybackSession {
  return {
    id: stringAt(v, "id"),
    url: capabilityUrl(stringAt(v, "url"), origin),
    format: optionalString(v, "format") ?? "hls",
    mode: optionalString(v, "mode") ?? "direct",
    videoMode: optionalString(v, "video_mode") ?? "copy",
    audioMode: optionalString(v, "audio_mode") ?? "copy",
    position: optionalNumber(v, "position") ?? 0,
    live: optionalBool(v, "live") ?? false,
    duration: optionalNumber(v, "duration") ?? 0,
    audioTracks: rawArray(v, "audio_tracks").filter(isObject).map(track),
    subtitleTracks: rawArray(v, "subtitle_tracks").filter(isObject).map(track),
    subtitlesSupported: optionalBool(v, "subtitles_supported") ?? false,
  };
}
function liveCategory(v: JsonObject) {
  return {
    id: idAt(v, "id"),
    name: stringAt(v, "name"),
    count: numberAt(v, "count"),
    raw: clean(v),
  };
}
function track(v: JsonObject) {
  return {
    inputIndex: numberAt(v, "input_index"),
    codec: optionalString(v, "codec"),
    language: optionalString(v, "language"),
    languageStatus: optionalString(v, "language_status") ?? "unknown",
    title: optionalString(v, "title") ?? "",
    selected: optionalBool(v, "selected") ?? false,
    supported: optionalBool(v, "supported") ?? false,
    selectable: optionalBool(v, "selectable") ?? false,
  };
}
function preferences(v: JsonObject): PlaybackPreferences {
  return {
    audioLanguage: stringAt(v, "audio_language"),
    subtitleLanguage: stringAt(v, "subtitle_language"),
    subtitlesEnabled: boolAt(v, "subtitles_enabled"),
    subtitleSize: enumAt(v, "subtitle_size", ["small", "normal", "large"]),
    subtitleStyle: enumAt(v, "subtitle_style", ["system", "shadow", "opaque"]),
    quality: enumAt(v, "quality", ["auto", "1080p", "720p", "480p"]),
    autoplay: boolAt(v, "autoplay"),
  };
}
function itemRequest(item: MediaItem): JsonObject {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    poster: item.poster ?? null,
    year: item.year ?? null,
    season: item.season ?? null,
    episode: item.episode ?? null,
    series_id: item.seriesId ?? null,
    source_addon_id: item.sourceAddonId ?? null,
    source_name: item.sourceName ?? null,
    source_fingerprint: item.sourceFingerprint ?? null,
    source_binge_group: item.sourceBingeGroup ?? null,
    source_release_group: item.sourceReleaseGroup ?? null,
    source_quality: item.sourceQuality ?? null,
    source_audio: item.sourceAudio ?? null,
  };
}
/** Server playback URLs are root-relative capabilities. AVPlay requires an absolute HTTPS URL. */
function capabilityUrl(value: string, origin: string) {
  const url = new URL(value, origin);
  if (url.origin !== origin || !url.pathname.startsWith("/media/"))
    throw new TvApiError(200, "Invalid server response", "invalid_response");
  return url.href;
}
function snakePlayback(v: PlaybackStart): JsonObject {
  return {
    stream_id: v.streamId,
    channel_id: v.channelId,
    position: v.position,
    capabilities: {
      max_width: v.capabilities.maxWidth,
      max_height: v.capabilities.maxHeight,
      h264: v.capabilities.h264,
      hevc: v.capabilities.hevc,
      aac: v.capabilities.aac,
      direct_play: v.capabilities.directPlay,
      direct_mp4: v.capabilities.directMp4,
      direct_hls: v.capabilities.directHls,
      hevc_sdr: v.capabilities.hevcSdr,
    },
    force_transcode: v.forceTranscode,
    managed_only: v.managedOnly,
    audio_track_index: v.audioTrackIndex,
    audio_language: v.audioLanguage,
    subtitle_track_index: v.subtitleTrackIndex,
    subtitles_off: v.subtitlesOff,
    startup_id: v.startupId,
  };
}
function snakePreferences(v: Partial<PlaybackPreferences>): JsonObject {
  return {
    audio_language: v.audioLanguage,
    subtitle_language: v.subtitleLanguage,
    subtitles_enabled: v.subtitlesEnabled,
    subtitle_size: v.subtitleSize,
    subtitle_style: v.subtitleStyle,
    quality: v.quality,
    autoplay: v.autoplay,
  };
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
function mediaKind(value: string): MediaKind {
  if (value === "movie" || value === "series" || value === "live") return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
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
  if (value !== null && typeof value === "object" && !Array.isArray(value))
    return value;
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
function arrayAt(v: JsonObject, key: string) {
  const value = v[key];
  if (!Array.isArray(value))
    throw new TvApiError(200, "Invalid server response", "invalid_response");
  return value.filter(isObject);
}
function rawArray(v: JsonObject, key: string): JsonValue[] {
  const value = v[key];
  return Array.isArray(value) ? value : [];
}
function strings(v: JsonObject, key: string) {
  return rawArray(v, key).flatMap((value) =>
    typeof value === "string" ? [value] : [],
  );
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
function optionalId(v: JsonObject, key: string) {
  const value = v[key];
  return typeof value === "string"
    ? value
    : typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : undefined;
}
function numberAt(v: JsonObject, key: string) {
  const value = v[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
function optionalNumber(v: JsonObject, key: string) {
  const value = v[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
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
function enumAt<T extends string>(
  v: JsonObject,
  key: string,
  values: readonly T[],
): T {
  const value = stringAt(v, key);
  if ((values as readonly string[]).includes(value)) return value as T;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
// Add-ons use both snake_case and camelCase (for example `proxyHeaders` and
// `externalUrl`), so match sensitive field fragments rather than only exact keys.
const privateField =
  /(url|uri|link|headers?|authorization|access.?token|refresh.?token|device.?code|device.?token|cookie|password|credential|proxy|referer|origin)/i;
function clean(value: JsonObject): JsonObject {
  const output: Record<string, JsonValue> = {};
  for (const [key, child] of Object.entries(value)) {
    if (privateField.test(key)) continue;
    output[key] = cleanValue(child);
  }
  return output;
}
function cleanValue(value: JsonValue | undefined): JsonValue {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(cleanValue);
  if (isObject(value)) return clean(value);
  return value;
}
function minimalItem(item: Pick<MediaItem, "id" | "type">): MediaItem {
  return {
    id: item.id,
    type: item.type,
    name: "",
    title: "",
    genres: [],
    raw: {},
  };
}
