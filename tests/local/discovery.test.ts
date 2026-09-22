import { describe, expect, it } from "vitest";
import { LocalAddonRegistry, LocalDiscovery, type LocalRegistryStorage } from "../../src/local";
import { TvApiError } from "../../src/api";

function memoryStorage(): LocalRegistryStorage {
  const store: { value: string | null } = { value: null };
  return {
    async load() {
      return store.value;
    },
    async save(value: string) {
      store.value = value;
    },
  };
}

const movieCatalog = {
  type: "movie",
  id: "top",
  name: "Top Movies",
  extra: [{ name: "genre", isRequired: false, options: ["Action", "Drama"] }],
};

const manifest = {
  id: "com.example.addon",
  name: "Example",
  resources: ["catalog", "meta", "stream"],
  types: ["movie"],
  catalogs: [movieCatalog],
};

const seriesCatalog = { type: "series", id: "series-top", name: "Series", extra: [] };
const seriesManifest = {
  id: "com.example.series",
  name: "Series Addon",
  catalogs: [seriesCatalog],
};

function discoveryWith(routes: Record<string, unknown>) {
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = routes[url];
    if (body === undefined) return new Response("missing", { status: 404 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const registry = new LocalAddonRegistry({
    storage: memoryStorage(),
    fetch: fetchImpl,
    now: () => 1,
  });
  return { registry, discovery: new LocalDiscovery(registry, { fetch: fetchImpl }), fetchImpl };
}

const metas = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    type: "movie",
    id: `m${index}`,
    name: `Title ${index}`,
    poster: `https://example.test/p${index}.jpg`,
  }));


describe("LocalDiscovery", () => {
  it("derives catalogs from enabled addons in installation order", async () => {
    const { discovery, registry } = discoveryWith({
      "https://one.test/manifest.json": manifest,
      "https://two.test/manifest.json": seriesManifest,
    });
    await registry.install("https://one.test/manifest.json");
    await registry.install("https://two.test/manifest.json");
    const catalogs = await discovery.catalogs();
    expect(catalogs.map(catalog => [catalog.type, catalog.id])).toEqual([
      ["movie", "top"],
      ["series", "series-top"],
    ]);
    expect(catalogs[0].addonName).toBe("Example");
    expect(catalogs[0].addonId).toBe(1);
    expect(catalogs[0].extras?.[0]).toMatchObject({ name: "genre", options: ["Action", "Drama"] });
    expect(catalogs[0].supportsSearch).toBe(false);
  });

  it("hides disabled addons from catalogs", async () => {
    const { discovery, registry } = discoveryWith({
      "https://one.test/manifest.json": manifest,
      "https://two.test/manifest.json": seriesManifest,
    });
    const first = await registry.install("https://one.test/manifest.json");
    await registry.install("https://two.test/manifest.json");
    await registry.setEnabled(first.ordinal, false);
    const catalogs = await discovery.catalogs();
    expect(catalogs.map(catalog => catalog.addonId)).toEqual([2]);
  });

  it("plans, fetches and aggregates a single-catalog browse", async () => {
    const { discovery, registry } = discoveryWith({
      "https://one.test/manifest.json": manifest,
      "https://one.test/catalog/movie/top.json": { metas: metas(3) },
    });
    await registry.install("https://one.test/manifest.json");
    const page = await discovery.discover({ type: "movie", catalog: "top" });
    expect(page.items).toHaveLength(3);
    expect(page.items[0]).toMatchObject({ id: "m0", type: "movie", name: "Title 0" });
    expect(page.hasMore).toBe(false);
    expect(page.unsupportedCount ?? 0).toBe(0);
  });

  it("aggregates search across addons and drops failed fetches", async () => {
    const { discovery, registry } = discoveryWith({
      "https://one.test/manifest.json": { ...manifest, catalogs: [{ ...movieCatalog, extra: [{ name: "search", isRequired: false }] }] },
      "https://one.test/catalog/movie/top/search=title.json": { metas: metas(2) },
      "https://two.test/manifest.json": { ...seriesManifest, catalogs: [{ ...seriesCatalog, extra: [{ name: "search", isRequired: false }] }] },
    });
    await registry.install("https://one.test/manifest.json");
    await registry.install("https://two.test/manifest.json");
    const page = await discovery.discover({ type: "movie", search: "title" });
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(false);
  });

  it("applies the declared genre filter and surfaces shared negotiation errors", async () => {
    const { discovery, registry } = discoveryWith({
      "https://one.test/manifest.json": manifest,
      "https://one.test/catalog/movie/top/genre=Action.json": { metas: metas(1) },
    });
    await registry.install("https://one.test/manifest.json");
    const page = await discovery.discover({ type: "movie", catalog: "top", genre: "Action" });
    expect(page.items).toHaveLength(1);
    await expect(discovery.discover({ type: "movie", catalog: "top", genre: "Horror" })).rejects.toMatchObject({
      status: 400,
      message: "Genre is not one of the catalog's advertised options",
    });
  });

  it("reports request validation with the backend's copy", async () => {
    const { discovery, registry } = discoveryWith({});
    await expect(discovery.discover({ type: "movie", search: "x".repeat(300) })).rejects.toMatchObject({
      status: 400,
      message: "Search too long",
    });
    await expect(discovery.discover({ type: "movie", genre: "g".repeat(200) })).rejects.toMatchObject({
      status: 400,
      message: "Genre too long",
    });
  });

  it("fails with the aggregation error when no source succeeds", async () => {
    const { discovery, registry } = discoveryWith({
      "https://one.test/manifest.json": manifest,
    });
    await registry.install("https://one.test/manifest.json");
    await expect(discovery.discover({ type: "movie", catalog: "top" })).rejects.toBeInstanceOf(TvApiError);
    await expect(discovery.discover({ type: "movie", catalog: "top" })).rejects.toMatchObject({
      status: 502,
      message: "No catalog source succeeded or matched this request",
    });
  });

  it("raises the unsupported media type error like the backend", async () => {
    const { discovery, registry } = discoveryWith({
      "https://one.test/manifest.json": manifest,
      "https://one.test/catalog/movie/top.json": {
        metas: [{ type: "banana", id: "b1", name: "Unsupported" }],
      },
    });
    await registry.install("https://one.test/manifest.json");
    await expect(discovery.discover({ type: "movie", catalog: "top" })).rejects.toMatchObject({
      code: "unsupported_media_type",
      message: "This catalog returned a media type this app does not support.",
    });
  });

  it("paginates by raw page length when the catalog declares skip", async () => {
    const skipCatalog = {
      ...movieCatalog,
      extra: [
        ...movieCatalog.extra,
        { name: "skip", isRequired: false, options: [] },
      ],
    };
    const { discovery, registry } = discoveryWith({
      "https://one.test/manifest.json": { ...manifest, catalogs: [skipCatalog] },
      "https://one.test/catalog/movie/top/skip=0.json": { metas: metas(5) },
      "https://one.test/catalog/movie/top/skip=5.json": { metas: metas(5) },
    });
    await registry.install("https://one.test/manifest.json");
    const first = await discovery.discover({ type: "movie", catalog: "top" });
    expect(first.items).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    expect(first.nextSkip).toBe(5);
    const second = await discovery.discover({ type: "movie", catalog: "top", skip: 5 });
    expect(second.items).toHaveLength(5);
  });

  it("propagates caller aborts", async () => {
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("top.json")) {
        return new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          const abort = () => reject(new DOMException("Aborted", "AbortError"));
          if (signal?.aborted) return abort();
          signal?.addEventListener("abort", abort);
        });
      }
      return new Response(JSON.stringify(manifest), { status: 200 });
    }) as typeof fetch;
    const registry = new LocalAddonRegistry({
      storage: memoryStorage(),
      fetch: fetchImpl,
      now: () => 1,
    });
    await registry.install("https://one.test/manifest.json");
    const discovery = new LocalDiscovery(registry, { fetch: fetchImpl });
    const controller = new AbortController();
    const pending = discovery.discover({ type: "movie", catalog: "top" }, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
  });
});
