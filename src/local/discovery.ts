/* Local-mode discovery (LM-003): byte-identical negotiation, aggregation,
   pagination and error copy because the same provider logic runs here in the
   vendored core wasm. Deviations from the backend contract are defects. */
import {
  addonCatalogExtras,
  discoverAggregate,
  discoverPlan,
} from "../../vendor/core/wasm/viptv_core";
import { normalizeCore, TvApiError, isAbort } from "../api";
import type { Catalog, DiscoverPage, DiscoverRequest, JsonObject, JsonValue } from "../api";
import type { LocalAddonRegistry } from "./registry";

const MAX_CATALOGS_PER_ADDON = 256;
const MAX_CATALOGS = 2048;
const MAX_ENDPOINT_BYTES = 8 * 1024 * 1024;
const ENDPOINT_TIMEOUT_MS = 20_000;

interface DiscoveryPlan {
  endpoints: string[];
  pageable: boolean;
  single_catalog: boolean;
  aggregated: boolean;
}

function message(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return fallback;
}

export interface LocalDiscoveryOptions {
  fetch?: typeof fetch;
}

export class LocalDiscovery {
  private readonly registry: LocalAddonRegistry;
  private readonly fetchImpl: typeof fetch;

  constructor(registry: LocalAddonRegistry, options?: LocalDiscoveryOptions) {
    this.registry = registry;
    this.fetchImpl = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Catalogs of all enabled addons, in installation order (LM-003). */
  async catalogs(): Promise<Catalog[]> {
    const raw: JsonObject[] = [];
    addons: for (const addon of await this.enabledAddons()) {
      const declared = Array.isArray(addon.manifest.catalogs) ? addon.manifest.catalogs : [];
      for (const catalog of declared.slice(0, MAX_CATALOGS_PER_ADDON)) {
        if (raw.length === MAX_CATALOGS) break addons;
        if (typeof catalog !== "object" || catalog === null) continue;
        const entry = catalog as JsonObject;
        const id = typeof entry.id === "string" ? entry.id.trim() : "";
        const type = typeof entry.type === "string" ? entry.type.trim() : "";
        if (!id || id.length > 256 || !type || type.length > 64) continue;
        const name =
          typeof entry.name === "string" && entry.name.trim() ? entry.name.trim().slice(0, 256) : id;
        const extras = JSON.parse(addonCatalogExtras(JSON.stringify(entry))) as JsonObject[];
        const genre = extras.find(extra => extra.name === "genre");
        raw.push({
          addon_id: addon.ordinal,
          addon_name: typeof addon.manifest.name === "string" ? addon.manifest.name : null,
          id,
          type,
          name,
          extra: extras,
          supports_search: extras.some(extra => extra.name === "search"),
          supports_skip: extras.some(extra => extra.name === "skip"),
          genres: Array.isArray(genre?.options) ? genre.options : [],
        });
      }
    }
    return normalizeCore<Catalog[]>("catalogs", raw);
  }

  /**
   * Browse or search across enabled local addons. Mirrors the backend's
   * `/api/discover` semantics: request validation errors, genre negotiation
   * errors and aggregation failures surface their shared copy; failed addon
   * fetches are dropped without failing the page.
   */
  async discover(
    request: DiscoverRequest,
    options?: { signal?: AbortSignal },
  ): Promise<DiscoverPage> {
    if (request.search && request.search.length > 256) {
      throw new TvApiError(400, "Search too long", "search", "GET /api/discover");
    }
    if (request.genre && request.genre.length > 128) {
      throw new TvApiError(400, "Genre too long", "genre", "GET /api/discover");
    }
    if (request.extras && JSON.stringify(request.extras).length > 8192) {
      throw new TvApiError(400, "Catalog options too large", "extras", "GET /api/discover");
    }
    const entries = (await this.enabledAddons()).map(
      addon => [addon.ordinal, addon.manifestUrl, addon.manifest] as const,
    );
    const discoveryRequest = {
      kind: request.type,
      catalog: request.catalog,
      addon: request.addonId,
      skip: request.skip ?? 0,
      search: request.search,
      genre: request.genre,
      extras: { ...(request.extras ?? {}) },
    };
    let plan: DiscoveryPlan;
    try {
      plan = JSON.parse(discoverPlan(JSON.stringify(entries), JSON.stringify(discoveryRequest)));
    } catch (error) {
      throw new TvApiError(400, message(error, "Invalid discovery request"), "discover_plan", "GET /api/discover");
    }
    const responses: JsonValue[] = [];
    for (const endpoint of plan.endpoints) {
      try {
        responses.push(await this.fetchJson(endpoint, options?.signal));
      } catch (error) {
        if (isAbort(error)) throw error;
      }
    }
    let page: JsonValue;
    try {
      page = JSON.parse(
        discoverAggregate(JSON.stringify(responses), JSON.stringify(plan), BigInt(request.skip ?? 0)),
      );
    } catch (error) {
      throw new TvApiError(
        502,
        message(error, "No catalog source succeeded or matched this request"),
        "discover_aggregate",
        "GET /api/discover",
      );
    }
    const normalized = normalizeCore<DiscoverPage>("discoverResponse", {
      response: page,
      type: request.type,
    });
    if (!normalized.items.length && normalized.unsupportedCount) {
      throw new TvApiError(
        200,
        "This catalog returned a media type this app does not support.",
        "unsupported_media_type",
      );
    }
    return normalized;
  }

  private async enabledAddons() {
    return (await this.registry.list()).filter(addon => addon.enabled);
  }

  private async fetchJson(endpoint: string, signal?: AbortSignal): Promise<JsonValue> {
    const timeout = AbortSignal.timeout(ENDPOINT_TIMEOUT_MS);
    const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await this.fetchImpl(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "follow",
      signal: composite,
    });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_ENDPOINT_BYTES) {
      throw new Error("Catalog response too large");
    }
    const text = await response.text();
    if (text.length > MAX_ENDPOINT_BYTES) throw new Error("Catalog response too large");
    return JSON.parse(text) as JsonValue;
  }
}
