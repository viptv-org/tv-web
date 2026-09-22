/* Local addon registry — the only persistent local-mode state (LM-002, LM-005).
   Design contract: design-contract/LOCAL_MODE.md. Copy below is normative:
   invalid URL, fetch/parse failure, and duplicate install each surface their
   own message; the manifest URL is a credential and is never logged. */
import { isAbort, type JsonObject } from "../api";

const REGISTRY_KEY = "viptv.local.registry.v1";
const MAX_ADDONS = 64;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MANIFEST_TIMEOUT_MS = 20_000;

export interface LocalAddon {
  /** Stable install counter; never reused, survives removals (LM-002). */
  readonly ordinal: number;
  /** Manifest id when present, otherwise the normalized manifest URL. */
  readonly id: string;
  readonly manifestUrl: string;
  readonly manifest: JsonObject;
  readonly installedAt: number;
  enabled: boolean;
}

interface StoredRegistry {
  version: 1;
  nextOrdinal: number;
  addons: LocalAddon[];
}

export interface LocalRegistryStorage {
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
}

/** Browser storage adapter; the registry never syncs anywhere (LM-005). */
export class BrowserLocalRegistryStorage implements LocalRegistryStorage {
  constructor(
    private readonly key: string = REGISTRY_KEY,
    private readonly area: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage,
  ) {}
  async load(): Promise<string | null> {
    return this.area.getItem(this.key);
  }
  async save(value: string): Promise<void> {
    this.area.setItem(this.key, value);
  }
}

export type LocalRegistryErrorCode = "invalid_url" | "install_failed" | "duplicate";

export class LocalRegistryError extends Error {
  readonly name = "LocalRegistryError";
  constructor(
    readonly code: LocalRegistryErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const INSTALL_FAILED = "Could not install this addon.";

/** https, no embedded credentials, no fragment (LM-002 URL entry). */
function parseAddonUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
  return url;
}

function addonId(manifest: JsonObject, url: URL): string {
  const declared = typeof manifest.id === "string" ? manifest.id.trim() : "";
  if (declared && declared.length <= 256) return declared;
  return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}`;
}

function storedAddons(value: string | null): { nextOrdinal: number; addons: LocalAddon[] } {
  if (!value) return { nextOrdinal: 1, addons: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { nextOrdinal: 1, addons: [] };
  }
  const registry = parsed as Partial<StoredRegistry>;
  if (registry.version !== 1 || !Array.isArray(registry.addons)) {
    return { nextOrdinal: 1, addons: [] };
  }
  const addons: LocalAddon[] = [];
  for (const entry of registry.addons) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Partial<LocalAddon>;
    if (
      typeof candidate.ordinal !== "number" ||
      !Number.isInteger(candidate.ordinal) ||
      typeof candidate.id !== "string" ||
      typeof candidate.manifestUrl !== "string" ||
      typeof candidate.manifest !== "object" ||
      candidate.manifest === null ||
      typeof candidate.installedAt !== "number" ||
      typeof candidate.enabled !== "boolean"
    ) {
      continue;
    }
    addons.push({
      ordinal: candidate.ordinal,
      id: candidate.id,
      manifestUrl: candidate.manifestUrl,
      manifest: candidate.manifest,
      installedAt: candidate.installedAt,
      enabled: candidate.enabled,
    });
    if (addons.length === MAX_ADDONS) break;
  }
  const nextOrdinal = Number.isInteger(registry.nextOrdinal)
    ? Math.max(registry.nextOrdinal as number, ...addons.map(addon => addon.ordinal), 0) + 1
    : addons.length + 1;
  return { nextOrdinal, addons };
}

export interface LocalRegistryOptions {
  storage: LocalRegistryStorage;
  /** Injectable for tests and hosts with their own network policy. */
  fetch?: typeof fetch;
  now?: () => number;
}

export class LocalAddonRegistry {
  private readonly storage: LocalRegistryStorage;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private cache: { nextOrdinal: number; addons: LocalAddon[] } | null = null;

  constructor(options: LocalRegistryOptions) {
    this.storage = options.storage;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? (() => Date.now());
  }

  /** Installed addons in installation order. */
  async list(): Promise<LocalAddon[]> {
    this.cache ??= storedAddons(await this.storage.load());
    return [...this.cache.addons];
  }

  async install(rawUrl: string, options?: { signal?: AbortSignal }): Promise<LocalAddon> {
    const url = parseAddonUrl(rawUrl);
    if (!url) throw new LocalRegistryError("invalid_url", "That does not look like an addon URL.");
    const state = await this.state();
    if (state.addons.some(addon => addon.manifestUrl === url.href)) {
      throw new LocalRegistryError("duplicate", "This addon is already installed.");
    }
    if (state.addons.length >= MAX_ADDONS) {
      throw new LocalRegistryError("install_failed", INSTALL_FAILED);
    }
    const manifest = await this.fetchManifest(url, options?.signal);
    if (!Array.isArray(manifest.catalogs) || manifest.catalogs.length === 0) {
      throw new LocalRegistryError("install_failed", INSTALL_FAILED);
    }
    const addon: LocalAddon = {
      ordinal: state.nextOrdinal,
      id: addonId(manifest, url),
      manifestUrl: url.href,
      manifest,
      installedAt: this.now(),
      enabled: true,
    };
    state.addons.push(addon);
    state.nextOrdinal = state.nextOrdinal + 1;
    await this.persist(state);
    return addon;
  }

  async remove(ordinal: number): Promise<void> {
    const state = await this.state();
    const next = state.addons.filter(addon => addon.ordinal !== ordinal);
    if (next.length === state.addons.length) return;
    state.addons = next;
    await this.persist(state);
  }

  async setEnabled(ordinal: number, enabled: boolean): Promise<void> {
    const state = await this.state();
    const addon = state.addons.find(addon => addon.ordinal === ordinal);
    if (!addon || addon.enabled === enabled) return;
    addon.enabled = enabled;
    await this.persist(state);
  }

  private async state(): Promise<{ nextOrdinal: number; addons: LocalAddon[] }> {
    this.cache ??= storedAddons(await this.storage.load());
    return this.cache;
  }

  private async persist(state: { nextOrdinal: number; addons: LocalAddon[] }): Promise<void> {
    await this.storage.save(
      JSON.stringify({ version: 1, nextOrdinal: state.nextOrdinal, addons: state.addons } satisfies StoredRegistry),
    );
  }

  private async fetchManifest(url: URL, signal?: AbortSignal): Promise<JsonObject> {
    const timeout = AbortSignal.timeout(MANIFEST_TIMEOUT_MS);
    const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await this.fetchImpl(url.href, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "follow",
        signal: composite,
      });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new LocalRegistryError("install_failed", INSTALL_FAILED);
    }
    if (!response.ok) throw new LocalRegistryError("install_failed", INSTALL_FAILED);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_MANIFEST_BYTES) {
      throw new LocalRegistryError("install_failed", INSTALL_FAILED);
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new LocalRegistryError("install_failed", INSTALL_FAILED);
    }
    if (text.length > MAX_MANIFEST_BYTES) {
      throw new LocalRegistryError("install_failed", INSTALL_FAILED);
    }
    try {
      const value = JSON.parse(text);
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return value as JsonObject;
      }
    } catch {
      // fall through to the shared failure copy
    }
    throw new LocalRegistryError("install_failed", INSTALL_FAILED);
  }
}
