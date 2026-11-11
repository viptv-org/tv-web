import { inScope } from "./operation-scope";
import { runtimeObserver } from "../platform/runtime-observation";
let requestSequence = 0;
import type {
  Bootstrap,
  CalendarSnapshot,
  Card,
  Controls,
  Detail,
  Home,
  Lease,
  LibraryPage,
  LibraryQuery,
  LivePage,
  LivePageRequest,
  Management,
  Page,
  Pairing,
  PlaybackSegment,
  Preferences,
  Source,
  SourcePage,
  SourceReplacement,
  TitleAction,
  Tokens,
} from "./types";
import { validateChannelPage } from "./channelWindow";
import { refusalMessage } from "./refusals";
import { configureImageDelivery } from "./image-source";
export class RemoteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RemoteError";
  }
}
/**
 * What `/api/auth/me` says about this session: its role and whether it may
 * change household settings. Either field stays `undefined` when the server did
 * not say, so callers cannot invent an answer.
 */
export interface AccountIdentity {
  role?: string;
  manageAccount?: boolean;
}
export interface SessionStore {
  load(): Promise<Tokens | null>;
  save(tokens: Tokens): Promise<void>;
  clear(): Promise<void>;
  withLock?<T>(work: () => Promise<T>): Promise<T>;
}
export const segment = encodeURIComponent;
export function query(values: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null)
      params.set(
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
  return params.toString();
}
export function abort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
}
async function snapshotText(
  response: Response,
  signal: AbortSignal,
): Promise<string> {
  const limit = 4 * 1024 * 1024;
  const tooLarge = () =>
    new RemoteError(
      502,
      "invalid_response",
      "The server response is too large.",
    );
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    void response.body?.cancel().catch(() => {});
    throw tooLarge();
  }
  if (!response.body) {
    // Roku's fetch Response exposes text() but not a WHATWG ReadableStream.
    const text = await response.text();
    if (text.length > limit) throw tooLarge();
    return text;
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let received = 0;
  const chunks: string[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      abort(signal);
      if (done) break;
      received += value.byteLength;
      if (received > limit) throw tooLarge();
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    abort(signal);
    const done = () => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const cancel = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", cancel, { once: true });
  });
}
/** Chrome 87 TV receivers have secure random bytes but not randomUUID.
 * SceneGraph's JavaScript engine has no `crypto` object at all; request IDs
 * only need uniqueness, so fall back to Math.random there. */
export function requestUuid(): string {
  const api = typeof crypto !== "undefined" ? crypto : undefined;
  let bytes: Uint8Array;
  if (api && typeof api.getRandomValues === "function") {
    bytes = api.getRandomValues(new Uint8Array(16));
  } else {
    bytes = new Uint8Array(16);
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const value = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
export function lookupSelector(card: Card): Card {
  return {
    identity: card.identity,
    parent_identity: card.parent_identity,
    provider_id: card.provider_id,
    title: card.title,
    badges: [],
    metadata_origin: card.metadata_origin,
  };
}
export function originFields(card: Card): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (card.provider_id === "simkl" || card.provider_id === "stremio")
    fields.metadata_provider_id = card.provider_id;
  else if (/^addon:[1-9][0-9]*$/.test(card.provider_id)) {
    fields.metadata_provider_id = "stremio";
    fields.metadata_addon_id = Number(card.provider_id.slice(6));
  }
  if (card.metadata_origin) {
    fields.metadata_origin = card.metadata_origin;
    fields.card = lookupSelector(card);
  }
  return fields;
}
/** Only HTTP, session rotation and operation lifetimes; no client engine. */
export class RemoteTvApi {
  private sourceReuseSupported = false;
  preferredSourceDiscoverySupported = false;
  private tokens: Tokens | null = null;
  private pendingTokens?: Tokens;
  private refreshFlight?: Promise<void>;
  private identityFlight?: Promise<AccountIdentity>;
  private epoch = 0;
  // Profile data and durable device grants have different lifetimes. A profile
  // switch retires its data requests but must retain a consumed token rotation.
  private authEpoch = 0;
  private clockOffset = 0;
  get serverNow() {
    return Date.now() + this.clockOffset;
  }
  private readonly fetcher: typeof fetch;
  readonly origin: string;
  profile = "";
  constructor(
    origin: string,
    private readonly store: SessionStore,
    fetcher?: typeof fetch,
    readonly platform: "web" | "tizen" | "vizio" | "webos" = "web",
  ) {
    const url = new URL(origin);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("The TV server must use an HTTPS origin.");
    this.origin = url.origin;
    this.fetcher = fetcher ?? globalThis.fetch.bind(globalThis);
  }
  async restore() {
    if (this.pendingTokens) return true;
    this.tokens = await this.store.load();
    if (
      this.tokens &&
      (typeof this.tokens.accessToken !== "string" ||
        !this.tokens.accessToken ||
        typeof this.tokens.refreshToken !== "string" ||
        !this.tokens.refreshToken)
    ) {
      this.tokens = null;
      await this.store.clear();
    }
    return !!this.tokens;
  }
  private async exchange<T>(
    path: string,
    method: string,
    body: unknown,
    signal: AbortSignal | undefined,
    access?: string,
  ): Promise<T> {
    if (typeof path !== "string" || !path.startsWith("/api/") || path.includes("://"))
      throw new Error("Invalid API path");
    abort(signal);
    const observe = runtimeObserver(), observation = observe ? ++requestSequence : 0;
    observe?.({phase:"http-start",at:performance.now(),request:observation,path:path.split("?")[0],method});
    const request = new AbortController();
    const cancel = () => request.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(() => request.abort(), 20000);
    let response: Response;
    let text: string;
    try {
      response = await this.fetcher(this.origin + path, {
        method,
        signal: request.signal,
        redirect: "error",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const serverDate = Date.parse(response.headers.get("date") ?? "");
      if (Number.isFinite(serverDate))
        this.clockOffset = serverDate - Date.now();
        text = await snapshotText(response, request.signal);
        observe?.({phase:"http-read",at:performance.now(),request:observation,characters:text.length,status:response.status});
    } catch (error) {
      if (!signal?.aborted && request.signal.aborted)
        throw new RemoteError(
          504,
          "timeout",
          "The server took too long. Try again.",
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }

    let value: Record<string, unknown> = {};
    try {
      value = text ? JSON.parse(text) : {};
    } catch {
      throw new RemoteError(
        502,
        "invalid_response",
        "The server returned an invalid response.",
      );
    }
    observe?.({phase:"http-json",at:performance.now(),request:observation});
    if (!response.ok) {
      const code = String(value.error_code ?? value.error ?? "request_failed");
      throw new RemoteError(
        response.status,
        code,
        refusalMessage(response.status, code),
      );
    }
    const images = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(images);
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          if (
            ["poster", "landscape", "logo"].includes(key) &&
            typeof child === "string" &&
            child.startsWith("/api/images/")
          )
            (value as Record<string, unknown>)[key] = this.origin + child;
          else images(child);
        }
      }
    };
    images(value);
    observe?.({phase:"http-ready",at:performance.now(),request:observation});
    return value as T;
  }
  async call<T>(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const epoch = this.epoch;
    const token = this.tokens?.accessToken;
    const current = () => {
      abort(signal);
      if (epoch !== this.epoch)
        throw new DOMException("Session changed", "AbortError");
    };
    if (this.pendingTokens) {
      await this.persistTokens();
      current();
    }
    try {
      const result = await this.exchange<T>(path, method, body, signal, token);
      current();
      return result;
    } catch (error) {
      // A retired view must not receive either data or an error. In particular,
      // an old 401/403 must not replace the current profile with a sign-in/PIN UI.
      current();
      if (
        !(error instanceof RemoteError) ||
        error.status !== 401 ||
        !this.tokens ||
        epoch !== this.epoch
      )
        throw error;
      try {
        await inScope(this.refresh(token), signal);
        current();
        const result = await this.exchange<T>(
          path,
          method,
          body,
          signal,
          this.tokens?.accessToken,
        );
        current();
        return result;
      } catch (retryError) {
        current();
        throw retryError;
      }
    }
  }
  private async refresh(previous?: string) {
    if (this.tokens?.accessToken !== previous) return;
    if (!this.refreshFlight) {
      const epoch = this.authEpoch;
      const rotate = async () => {
        const saved = this.pendingTokens ?? await this.store.load();
        if (epoch !== this.authEpoch) return;
        if (saved && saved.refreshToken !== this.tokens?.refreshToken) {
          this.tokens = saved;
          return;
        }
        try {
          const value = await this.exchange<Record<string, unknown>>(
            "/api/auth/device/refresh",
            "POST",
            { refresh_token: this.tokens?.refreshToken },
            undefined,
          );
          if (epoch === this.authEpoch) await this.adopt(value);
        } catch (error) {
          if (
            error instanceof RemoteError &&
            error.status === 401 &&
            epoch === this.authEpoch
          ) {
            this.tokens = null;
            this.pendingTokens = undefined;
            await this.store.clear();
          }
          throw error;
        }
      };
      this.refreshFlight = (
        this.store.withLock ? this.store.withLock(rotate) : rotate()
      ).finally(() => {
        this.refreshFlight = undefined;
      });
    }
    await this.refreshFlight;
  }
  private async adopt(value: Record<string, unknown>) {
    if (
      typeof value.access_token !== "string" ||
      typeof value.refresh_token !== "string"
    )
      throw new RemoteError(
        502,
        "invalid_tokens",
        "Sign-in returned an incomplete response.",
      );
    const tokens: Tokens = {
      accessToken: value.access_token,
      refreshToken: value.refresh_token,
      expiresAt: Date.now() + Number(value.expires_in ?? 0) * 1000,
      accountId: String(value.account_id ?? ""),
      sessionId: String(value.session_id ?? ""),
    };
    this.tokens = tokens;
    this.pendingTokens = tokens;
    this.identityFlight = undefined;
    await this.persistTokens();
  }
  private async persistTokens() {
    const tokens = this.pendingTokens;
    if (!tokens) return;
    try {
      await this.store.save(tokens);
      if (this.pendingTokens === tokens) this.pendingTokens = undefined;
    } catch {
      // A consumed refresh token must never replace its unsaved successor.
    }
  }
  pair(signal?: AbortSignal) {
    return this.exchange<Pairing>(
      "/api/auth/device/code",
      "POST",
      { device_name: "VIPTV television" },
      signal,
    );
  }
  async claim(code: string, signal?: AbortSignal) {
    const value = await this.exchange<Record<string, unknown>>(
      "/api/auth/device/token",
      "POST",
      { device_code: code },
      signal,
    );
    abort(signal);
    this.epoch++;
    this.authEpoch++;
    await this.adopt(value);
  }
  async bootstrap(signal?: AbortSignal) {
    const value = await this.call<Bootstrap>(
      "/api/bootstrap",
      "GET",
      undefined,
      signal,
    );
    if (value.contract_version !== 3 || !value.profile_management?.profiles)
      throw new RemoteError(
        502,
        "unsupported_contract",
        "This server needs an update.",
      );
    const profile = String(value.identity.profile_id ?? "");
    if (this.profile && profile !== this.profile) this.epoch++;
    this.profile = profile;
    this.preferredSourceDiscoverySupported = value.preferred_source_discovery_supported === true;
    configureImageDelivery(value.clearlogo_image_supported === true);
    this.sourceReuseSupported = this.preferredSourceDiscoverySupported;
    return value;
  }
  async selectProfile(id: string, signal?: AbortSignal) {
    await this.call("/api/auth/profile", "POST", { profile_id: id }, signal);
    this.epoch++;
    this.profile = "";
    return this.bootstrap(signal);
  }
  async signOut() {
    await this.call("/api/auth/logout", "POST", {});
    this.epoch++;
    this.authEpoch++;
    this.profile = "";
    this.tokens = null;
    this.pendingTokens = undefined;
    this.identityFlight = undefined;
    await this.store.clear();
  }
  /**
   * This session's role and household-write capability. `/api/bootstrap` does
   * not project either, so both are read from the one identity route a device
   * session may still call, once per grant. `undefined` fields mean the server
   * did not say — callers must not invent an answer.
   */
  accountIdentity(): Promise<AccountIdentity> {
    if (!this.identityFlight)
      this.identityFlight = this.readIdentity().catch(() => ({}));
    return this.identityFlight;
  }
  async canManageAccount(): Promise<boolean | undefined> {
    return (await this.accountIdentity()).manageAccount;
  }
  private async readIdentity(): Promise<AccountIdentity> {
    const value = await this.call<{
      role?: unknown;
      capabilities?: { manage_account?: unknown };
    }>("/api/auth/me");
    const flag = value.capabilities?.manage_account;
    return {
      role: typeof value.role === "string" ? value.role : undefined,
      manageAccount: typeof flag === "boolean" ? flag : undefined,
    };
  }
  scoped(suffix: string) {
    if (!this.profile) throw new Error("Choose a profile first.");
    return `/api/profiles/${segment(this.profile)}${suffix}`;
  }
  get scopeEpoch() {
    return this.epoch;
  }
  retireProfile() {
    this.epoch++;
    this.profile = "";
  }
  home(signal?: AbortSignal) {
    return this.call<Home>(this.scoped("/home"), "GET", undefined, signal);
  }
  calendar(signal?: AbortSignal) {
    return this.call<CalendarSnapshot>("/api/calendar", "GET", undefined, signal);
  }
  profiles(signal?: AbortSignal) {
    return this.call<Management>("/api/profiles", "GET", undefined, signal);
  }
  preferences(signal?: AbortSignal) {
    return this.call<Preferences>(
      this.scoped("/preferences"),
      "GET",
      undefined,
      signal,
    );
  }
  controls(type: string, signal?: AbortSignal) {
    return this.call<Controls>(
      `/api/discovery-controls?${query({ type })}`,
      "GET",
      undefined,
      signal,
    );
  }
  discover(values: Record<string, unknown>, signal?: AbortSignal) {
    return this.call<Page>(
      `/api/discover?${query(values)}`,
      "GET",
      undefined,
      signal,
    );
  }
  library(cursor = "0", signal?: AbortSignal, values: LibraryQuery = {}) {
    return this.call<LibraryPage>(
      this.scoped(
        `/library?${query({ ...values, offset: cursor, limit: 40 })}`,
      ),
      "GET",
      undefined,
      signal,
    );
  }
  async detail(card: Card, offset = "0", signal?: AbortSignal) {
    const identity = card.parent_identity ?? card.identity;
    const expected = { ...card, identity, parent_identity: null };
    const fields = originFields(expected);
    return this.call<Detail>(
      `/api/meta/${segment(identity.kind)}/${segment(identity.id)}?${query({ offset, limit: 24, provider_id: fields.metadata_provider_id, addon_id: fields.metadata_addon_id, metadata_origin: fields.metadata_origin, card: fields.card })}`,
      "GET",
      undefined,
      signal,
    );
  }
  titleAction(card: Card, restart = false, signal?: AbortSignal) {
    return this.call<TitleAction>(
      this.scoped("/viewing-action"),
      "POST",
      { card: lookupSelector(card), restart },
      signal,
    );
  }
  next(card: Card, signal?: AbortSignal) {
    return this.call<{ status: string; item?: Card }>(
      this.scoped("/continue/next"),
      "POST",
      {
        identity: card.identity,
        parent_identity: card.parent_identity,
        ...originFields(card),
      },
      signal,
    );
  }
  async live(
    cursor = "0",
    group?: string,
    signal?: AbortSignal,
    search?: string,
    paging?: Pick<LivePageRequest, "limit" | "page_size">,
  ) {
    const request = {
      cursor,
      limit: paging?.limit ?? 40,
      page_size: paging?.page_size ?? 40,
    };
    const value = await this.call<LivePage>(
      this.scoped(
        `/live/channels?${query({ offset: cursor, group_id: group, search, limit: request.limit, page_size: paging?.page_size })}`,
      ),
      "GET",
      undefined,
      signal,
    );
    if (
      typeof value.snapshot_id !== "string" ||
      !value.snapshot_id ||
      value.snapshot_id.length > 256
    )
      throw new Error(
        "The server did not identify this channel snapshot. Try again after updating the server.",
      );
    return validateChannelPage(value, request);
  }
  async sources(
    card: Card,
    publish: (
      sources: Source[],
      page: SourcePage,
      ids: string[],
      height?: number,
    ) => void,
    signal: AbortSignal,
    channel?: string,
    quality: () => number | undefined = () => undefined,
    reuse?: import('./device-playback').SourceReuseContext,
    excludePreferred = false,
  ): Promise<Source[]> {
    const started = await this.call<{
      id?: string;
      streams?: Source[];
      action?: TitleAction;
    }>(
      channel
        ? this.scoped(`/live/${segment(channel)}/sources`)
        : "/api/streams",
      "POST",
      channel
        ? {}
        : {
            type: card.identity.kind,
            id: card.identity.id,
            series_id: card.parent_identity?.id,
            season: card.identity.episode?.season,
            episode: card.identity.episode?.episode,
            ...originFields(card),
            ...(this.preferredSourceDiscoverySupported && (reuse?.title || reuse?.across) ? {
              ...(reuse.title ? { remembered_source: this.memoryWire(reuse.title) } : {}),
              ...(reuse.across ? { cross_title_source: this.memoryWire(reuse.across) } : {}),
              device_max_height: this.deviceHeight(),
              ...(excludePreferred ? { exclude_preferred_source: true } : {}),
            } : {}),
          },
      signal,
    );
    if (channel && started.streams) {
      if (
        !started.action?.card ||
        !["ask", "best"].includes(started.action.source_selection)
      )
        throw new RemoteError(
          502,
          "unsupported_live_action",
          "This server needs an update for Live playback.",
        );
      const ids = started.streams.map((source) => source.id);
      const height = quality();
      const result = {
        ...(await this.rankSources(ids, height, signal, reuse)),
        action: started.action,
      };
      publish(result.streams, result, ids, height);
      return result.streams;
    }
    if (!started.id)
      throw new RemoteError(
        502,
        "invalid_discovery",
        "The server returned an invalid source response.",
      );
    let complete = false,
      after = 0;
    const ids = new Set<string>();
    const deadline = Date.now() + 60000;
    let ranked: Source[] = [];
    try {
      while (Date.now() < deadline) {
        const page = await this.call<{
          events: { streams?: Source[] }[];
          done: boolean;
          phase?: "preferred" | "fallback";
        }>(
          `/api/streams/${segment(started.id)}?after=${after}&wait_ms=10000`,
          "GET",
          undefined,
          signal,
        );
        for (const event of page.events)
          for (const source of event.streams ?? []) ids.add(source.id);
        after += page.events.length;
        if (ids.size && page.events.length) {
          const height = quality();
          const result = await this.rankSources([...ids], height, signal, reuse);
          if (this.preferredSourceDiscoverySupported) result.discovery_phase = page.phase;
          ranked = result.streams;
          publish(ranked, result, [...ids], height);
        }
        if (page.done) {
          complete = true;
          return ranked;
        }
        if (!page.events.length) await delay(300, signal);
      }
      throw new RemoteError(
        504,
        "discovery_timeout",
        "Sources took too long. Try again.",
      );
    } finally {
      if (!complete)
        void this.call(`/api/streams/${segment(started.id)}`, "DELETE").catch(
          () => {},
        );
    }
  }

  async release(path: string): Promise<void> {
    const cleanup = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        cleanup.abort();
        resolve();
      }, 5000);
    });
    try {
      await Promise.race([
        this.call(path, "DELETE", undefined, cleanup.signal).then(
          () => {},
          () => {},
        ),
        deadline,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private deviceHeight() {
    return Math.min(4320, Math.max(144, Math.round((globalThis.screen?.height || 1080) * (globalThis.devicePixelRatio || 1))));
  }
  private memoryWire(value: import('./device-playback').SourceChoice) {
    if (this.preferredSourceDiscoverySupported) return value;
    const { source_id: _sourceId, ...legacy } = value;
    return legacy;
  }
  async rankSources(
    ids: string[],
    height?: number,
    signal?: AbortSignal,
    reuse?: import('./device-playback').SourceReuseContext,
  ): Promise<SourcePage> {
    // A title can produce well over a thousand add-on sources. The server
    // caps request bodies at 64 KiB, and a single ranking request with every
    // UUID then answers 413 — which used to leave the picker empty. Rank in
    // bounded batches and merge the pages back into one ranked list.
    const unique = [...new Set(ids)];
    const deviceMaxHeight = this.deviceHeight();
    const batch = 400;
    const pages: SourcePage[] = [];
    const hasMemory = !!(reuse?.title || reuse?.across);
    const rank = async (ids: string[]): Promise<SourcePage> => {
      const body = { ids, device_max_height: deviceMaxHeight, quality_height: height };
      const memory = { ...(reuse?.title ? { remembered_source: this.memoryWire(reuse.title) } : {}),
        ...(reuse?.across ? { cross_title_source: this.memoryWire(reuse.across) } : {}) };
      const sentMemory = this.sourceReuseSupported && hasMemory;
      let result = await this.call<SourcePage>(this.scoped("/source-ranking"), "POST",
        { ...body, ...(sentMemory ? memory : {}) }, signal);
      this.sourceReuseSupported = result.source_reuse_supported === true;
      // Old servers reject unknown fields. Negotiate through their ordinary
      // rank response before sending optional device-memory observations.
      if (this.sourceReuseSupported && hasMemory && !sentMemory)
        result = await this.call<SourcePage>(this.scoped("/source-ranking"), "POST", { ...body, ...memory }, signal);
      if (!this.preferredSourceDiscoverySupported) delete result.source_reuse_ready;
      return result;
    };
    for (let start = 0; start < unique.length; start += batch) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      pages.push(await rank(unique.slice(start, start + batch)));
    }
    if (!pages.length) return { streams: [], quality_filters: [], total: 0 };
    if (pages.length === 1) return pages[0];
    // Top-five base and top-three reuse rows from each sorted batch contain
    // the global top-three start candidates. Rust makes the final decision;
    // the client never compares quality/provider/language ranking keys.
    const shortlist = [...new Set(pages.flatMap(page => [
      ...(page.best_match_ids ?? (page.best_match_id ? [page.best_match_id] : [])),
      ...(page.automatic_source_ids ?? []).slice(0, 3),
      ...(page.source_reuse_ids ?? []).slice(0, 3),
    ]))];
    const decision = shortlist.length > batch ? await this.rankSources(shortlist, height, signal, reuse)
      : shortlist.length ? await rank(shortlist) : pages[0];
    const seen = new Set<string>();
    const streams: Source[] = [];
    for (const page of [decision, ...pages]) for (const source of page.streams)
      if (!seen.has(source.id)) { seen.add(source.id); streams.push(source); }
    const filters = new Map<number, { height: number; label: string; count: number }>();
    for (const page of pages) for (const filter of page.quality_filters) {
      const current = filters.get(filter.height);
      filters.set(filter.height, { ...filter, count: (current?.count ?? 0) + filter.count });
    }
    return { ...decision, streams, quality_filters: [...filters.values()].sort((a, b) => b.height - a.height),
      total: pages.reduce((total, page) => total + page.total, 0) };
  }
  async admit(
    source: Source,
    resume: boolean,
    signal: AbortSignal,
    position?: number,
    selection: {
      audio_track?: number;
      subtitle_track?: number;
      subtitles_off?: boolean;
    } = {},
    replaceSource?: SourceReplacement,
    direct = false,
  ): Promise<Lease> {
    const requestId = requestUuid();
    let id: string | undefined;
    const started = Date.now();
    try {
      let value = await this.call<Lease>(
        "/api/playback",
        "POST",
        {
          request_id: requestId,
          stream_id: source.id,
          client: {
            // A direct session is the browser's own decoder. The backend only
            // returns original media for a non-Vizio web platform, an https
            // source and no upstream headers; otherwise it returns a gateway
            // delivery and the normal path takes over.
            platform: direct ? "web" : this.platform,
            max_width: 1920,
            max_height: 1080,
            can_play_direct: direct,
            video_codecs: direct
              ? ["h264", "hevc", "vp9", "av1"]
              : ["h264"],
            audio_codecs: direct
              ? ["aac", "mp3", "ac3", "eac3", "opus"]
              : ["aac"],
          },
          force_gateway: !direct,
          resume,
          position: position ?? 0,
          ...selection,
          ...(this.preferredSourceDiscoverySupported && !direct && selection.audio_track === undefined && source.reuse_audio_language ? { audio_language: source.reuse_audio_language } : {}),
          ...(replaceSource ? { replace_source: replaceSource } : {}),
        },
        signal,
      );
      id = value.id;
      while (value.status !== "ready") {
        if (
          ["failed", "stopped", "expired"].includes(value.status) ||
          Date.now() - started > 60000
        )
          throw new RemoteError(
            502,
            "playback_failed",
            "This source could not play. Choose another source.",
          );
        await delay(250, signal);
        value = await this.call<Lease>(
          `/api/playback/${segment(id)}`,
          "GET",
          undefined,
          signal,
        );
      }
      if (
        !value.delivery ||
        !["gateway", "direct"].includes(value.delivery.kind) ||
        new URL(value.delivery.url).protocol !== "https:"
      )
        throw new RemoteError(
          502,
          "invalid_delivery",
          "The server returned an unsupported delivery.",
        );
      if (
        !Number.isFinite(value.expires_at) ||
        Number(value.expires_at) * 1000 <= this.serverNow
      )
        throw new RemoteError(
          409,
          "playback_expired",
          "Playback authorization expired.",
        );
      return value;
    } catch (error) {
      void this.release(
        id
          ? `/api/playback/${segment(id)}`
          : `/api/playback-requests/${segment(requestId)}`,
      );
      throw error;
    }
  }

  async segments(
    playbackId: string,
    signal: AbortSignal,
  ): Promise<{ segments: PlaybackSegment[] }> {
    return this.call<{ segments: PlaybackSegment[] }>(
      `/api/playback/${segment(playbackId)}/segments`,
      "GET",
      undefined,
      signal,
    );
  }
}
