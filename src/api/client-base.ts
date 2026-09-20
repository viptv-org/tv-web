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
  StreamPoll,
  TvApiErrorShape,
  TvIdentity,
  TvProfile,
} from "./types";

export class TvApiClientBase {
  protected readonly origin: string;
  protected readonly requestFetch: typeof fetch;
  protected readonly store: DeviceSessionStore;
  protected tokens: DeviceTokenSet | null = null;
  protected refreshFlight: Promise<DeviceTokenSet> | null = null;
  protected sessionEvent?: (event: Event, options?: RequestOptions) => Promise<ViewModel>;

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
    const runUnlocked = async (event: Event, options?: RequestOptions): Promise<ViewModel> => {
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
    const run = (event: Event, options?: RequestOptions) => this.withSessionLock(async () => {
      const saved = await this.store.load();
      if (saved && this.tokens && saved.sessionId === this.tokens.sessionId && saved.accountId === this.tokens.accountId
        && saved.refreshToken !== this.tokens.refreshToken && !(typeof event === "object" && "AdoptSession" in event)) {
        const adopted = await runUnlocked({ AdoptSession: { tokensJson: JSON.stringify(saved) } });
        if (event === "Retry") return adopted;
      }
      return runUnlocked(event, options);
    });
    this.sessionEvent = run;
    return { ...driver, dispatch: (event: Event) => this.withSessionLock(async () => {
      await driver.dispatch(event);
      await driver.idle();
    }), dispose: () => {
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
  /** Browser cookie authentication approves only this pending viewing grant.
   * Passwords never enter core state, bearer storage, URLs, or diagnostics. */
  async browserSignIn(username: string, password: string, userCode: string, options?: RequestOptions): Promise<void> {
    const post = async (path: string, body: Record<string, string>, csrf?: string) => {
      const response = await this.requestFetch(`${this.origin}${path}`, {
        method: "POST", credentials: "include", redirect: "error", signal: options?.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
        body: JSON.stringify(body),
      });
      const payload = expectObject(await safeJson(response));
      if (!response.ok) throw new TvApiError(response.status,
        response.status === 401 ? "The username or password is incorrect." : response.status === 429 ? "Too many attempts. Please try again shortly." : "Sign-in could not complete. Please try again.");
      return payload;
    };
    const login = await post("/api/auth/login", { username: username.trim(), password });
    const csrf = optionalString(login, "csrf_token");
    if (!csrf) throw new TvApiError(200, "Sign-in returned an incomplete response. Please try again.");
    await post("/api/auth/device/approve", { user_code: userCode }, csrf);
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
  protected async domainRequest(input: unknown, options?: RequestOptions): Promise<JsonValue> {
    const request = normalizeCore<{ method: string; path: string; body: JsonObject | null }>("request", input);
    return this.raw(request.path, { method: request.method, body: request.body ?? undefined }, true, options);
  }

  protected async deviceTokens(
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
  protected async saveTokens(tokens: DeviceTokenSet) {
    this.tokens = tokens;
    await this.store.save(tokens);
    return tokens;
  }
  protected withSessionLock<T>(work: () => Promise<T>): Promise<T> {
    return this.store.withLock ? this.store.withLock(work) : work();
  }
  protected async refreshTokens(
    options?: RequestOptions,
  ): Promise<DeviceTokenSet> {
    options?.signal?.throwIfAborted();
    // Rotation belongs to the device session. Cancelling a screen must not
    // discard the replacement grant after the server consumes its predecessor.
    if (!this.tokens)
      throw new TvApiError(401, "Pairing required", "unauthorized");
    if (this.sessionEvent) {
      if (!this.refreshFlight) this.refreshFlight = this.sessionEvent("Retry").then(() => {
        if (!this.tokens) throw new TvApiError(401, "Pairing required", "unauthorized");
        return this.tokens;
      }).finally(() => { this.refreshFlight = null; });
      return this.refreshFlight;
    }
    if (!this.refreshFlight)
      this.refreshFlight = this.withSessionLock(async () => {
        const saved = await this.store.load();
        if (saved && saved.sessionId === this.tokens?.sessionId && saved.accountId === this.tokens.accountId
          && saved.refreshToken !== this.tokens.refreshToken) {
          this.tokens = saved;
          return saved;
        }
        const tokens = await this.deviceTokens("/api/auth/device/refresh", this.tokens!.refreshToken);
        return this.saveTokens(tokens);
      })
        .catch(async (error: unknown) => {
          if (
            error instanceof TvApiError &&
            error.status === 401
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
  protected async raw(
    path: string,
    init: { method?: string; body?: JsonObject } = {},
    authenticated: boolean,
    options?: RequestOptions,
  ): Promise<JsonValue> {
    // Failures are labeled with the request that produced them, so dialogs
    // can say what was happening instead of just "something failed".
    const endpoint = `${init.method ?? "GET"} ${path}`;
    const request = async (retry: boolean): Promise<JsonValue> => {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (init.body) headers["Content-Type"] = "application/json";
      options?.signal?.throwIfAborted();
      const accessToken = this.tokens?.accessToken;
      if (authenticated && accessToken)
        headers.Authorization = `Bearer ${accessToken}`;
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
        throw new TvApiError(0, "Network request failed", "network", endpoint);
      }
      if (response.status === 401 && authenticated && retry) {
        // Another in-flight request may already have rotated this bearer.
        // Retry with that replacement instead of rotating again for a late 401.
        if (accessToken === this.tokens?.accessToken) await this.refreshTokens(options);
        return request(false);
      }
      const payload = await safeJson(response);
      if (!response.ok) {
        const error = objectOrEmpty(payload);
        throw new TvApiError(
          response.status,
          clientMessage(response.status),
          optionalString(error, "error_code"),
          endpoint,
        );
      }
      return payload;
    };
    return request(true);
  }

  /**
   * Backend reachability for the connectivity surface. A 5xx from the
   * gateway means the backend behind it is still down, so only an answer
   * below 500 counts as recovered.
   */
  async probeBackend(timeoutMs = 4000): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.requestFetch(`${this.origin}/api/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      return response.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
