/* Shared client kernel: the WASM normalization wrapper, the error and
   session-store types, and the module-level decode helpers used by both
   halves of the TvApi class. */
import { normalizeCore as normalizeRust } from "../core";

export function normalizeResponse<T>(kind: string, value: unknown, origin = ""): T {
  try { return normalizeRust<T>(kind, value, origin); }
  catch { throw new TvApiError(200, "Invalid server response", "invalid_response"); }
}
import type {
  DeviceTokenSet,
  JsonObject,
  JsonValue,
  MediaItem,
  Page,
  PlaybackPreferences,
  TvApiErrorShape,
  TvProfile,
} from "./types";

export class TvApiError extends Error implements TvApiErrorShape {
  readonly name = "TvApiError";
  constructor(
    readonly status: number,
    readonly message: string,
    readonly code?: string,
    /** The method and path the request was making when it failed. */
    readonly endpoint?: string,
  ) {
    super(message);
  }
}

export interface DeviceSessionStore {
  load(): Promise<DeviceTokenSet | null>;
  save(tokens: DeviceTokenSet): Promise<void>;
  clear(): Promise<void>;
  /** Serialize session transactions across hosts sharing this durable grant. */
  withLock?<T>(work: () => Promise<T>): Promise<T>;
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
  readonly playbackPlatform?: import('../../vendor/core/typescript/wire').PlaybackPlatform | 'html5' | 'tauri';
  /** Development-only, same-origin HTTP preview on the trusted LAN. */
  readonly allowInsecurePreview?: boolean;
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly sessionStore?: DeviceSessionStore;
}
export interface RequestOptions {
  readonly signal?: AbortSignal;
}
/** AbortSignal.throwIfAborted shipped in Chrome 100; the TV receiver runs Chrome 87. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Aborted", "AbortError");
  }
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


export function safeJson(response: Response): Promise<JsonValue> {
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
export function isAbort(value: unknown): value is DOMException {
  return value instanceof DOMException && value.name === "AbortError";
}
export function tokenSet(v: JsonObject): DeviceTokenSet {
  return normalizeResponse("tokens", v);
}
export function profile(v: JsonObject): TvProfile {
  return normalizeResponse("profile", v);
}


export function mediaItem(v: JsonObject): MediaItem {
  return normalizeResponse("media", v);
}
export function page(v: JsonObject): Page<MediaItem> {
  return normalizeResponse("page", v);
}
export function preferences(v: JsonObject): PlaybackPreferences {
  return normalizeResponse("preferences", v);
}
export function snakePreferences(v: Partial<PlaybackPreferences>): JsonObject {
  return normalizeResponse("preferencesRequest", v);
}
export function params(entries: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(entries))
    if (value !== undefined) p.set(key, String(value));
  const text = p.toString();
  return text ? `?${text}` : "";
}
export function segment(value: string) {
  return encodeURIComponent(value);
}
export function objectOrEmpty(value: JsonValue): JsonObject {
  return isObject(value) ? value : {};
}
export function expectObject(value: JsonValue): JsonObject {
  if (isObject(value)) return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
export function objectAt(v: JsonObject, key: string) {
  const value = v[key];
  if (value !== undefined && isObject(value)) return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
export function hasObject(v: JsonObject, key: string) {
  const value = v[key];
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function arrayValue(value: JsonValue) {
  if (Array.isArray(value)) return value.filter(isObject);
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
function isObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function stringAt(v: JsonObject, key: string) {
  const value = v[key];
  if (typeof value === "string" && value.length) return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
export function optionalString(v: JsonObject, key: string) {
  const value = v[key];
  return typeof value === "string" ? value : undefined;
}
export function idAt(v: JsonObject, key: string) {
  const value = v[key];
  if (typeof value === "string" && value.length) return value;
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
export function boolAt(v: JsonObject, key: string) {
  const value = v[key];
  if (typeof value === "boolean") return value;
  throw new TvApiError(200, "Invalid server response", "invalid_response");
}
export function optionalBool(v: JsonObject, key: string) {
  const value = v[key];
  return typeof value === "boolean" ? value : undefined;
}
export function clean(value: JsonObject): JsonObject {
  return normalizeResponse("clean", value);
}

export function minimalItem(item: Pick<MediaItem, "id" | "type">): MediaItem {
  return {
    id: item.id,
    type: item.type,
    name: "",
    title: "",
    genres: [], episodes: [],
    raw: {},
  };
}
