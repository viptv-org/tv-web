import { describe, expect, it } from "vitest";
import {
  BrowserLocalRegistryStorage,
  LocalAddonRegistry,
  LocalRegistryError,
  type LocalRegistryStorage,
} from "../../src/local";
import type { JsonObject } from "../../src/api";

function memoryStorage(initial = ""): LocalRegistryStorage & { value: string } {
  const store = { value: initial };
  return {
    value: "",
    async load() {
      return store.value || null;
    },
    async save(value: string) {
      store.value = value;
    },
  } as LocalRegistryStorage & { value: string };
}

// The storage contract is what the browser adapter promises; exercise it once
// against the jsdom-provided localStorage.
function browserStorageSpy() {
  const area = {
    getItem(key: string) {
      return globalThis.localStorage.getItem(key);
    },
    setItem(key: string, value: string) {
      globalThis.localStorage.setItem(key, value);
    },
  };
  return new BrowserLocalRegistryStorage("test.local.registry", area);
}

const manifest = (overrides: JsonObject = {}): JsonObject => ({
  id: "com.example.addon",
  name: "Example",
  catalogs: [{ type: "movie", id: "top", name: "Top", extra: [] }],
  ...overrides,
});

function registryWith(fetchImpl: typeof fetch, storage = memoryStorage()) {
  let clock = 1_000;
  const registry = new LocalAddonRegistry({
    storage,
    fetch: fetchImpl,
    now: () => clock++,
  });
  return { registry, storage, tick: () => (clock += 100) };
}

const jsonResponse = (value: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });

describe("LocalAddonRegistry", () => {
  it("installs a manifest and persists installation order", async () => {
    const fetchImpl = (async () => jsonResponse(manifest())) as typeof fetch;
    const { registry, storage } = registryWith(fetchImpl);
    const addon = await registry.install("https://example.test/manifest.json");
    expect(addon).toMatchObject({
      ordinal: 1,
      id: "com.example.addon",
      manifestUrl: "https://example.test/manifest.json",
      enabled: true,
    });
    expect(await registry.list()).toHaveLength(1);
    const stored = JSON.parse((await storage.load()) ?? "{}");
    expect(stored.nextOrdinal).toBe(2);
    expect(stored.addons[0].ordinal).toBe(1);
  });

  it("rejects URLs that are not https addon manifests", async () => {
    const { registry } = registryWith((async () => jsonResponse(manifest())) as typeof fetch);
    for (const bad of ["", "not a url", "http://example.test/manifest.json", "https://user:pass@example.test/m.json", "https://example.test/m.json#frag"]) {
      await expect(registry.install(bad)).rejects.toMatchObject({
        code: "invalid_url",
        message: "That does not look like an addon URL.",
      });
    }
  });

  it("reports duplicates by manifest URL", async () => {
    const { registry } = registryWith((async () => jsonResponse(manifest())) as typeof fetch);
    await registry.install("https://example.test/manifest.json");
    await expect(registry.install("https://example.test/manifest.json")).rejects.toMatchObject({
      code: "duplicate",
      message: "This addon is already installed.",
    });
  });

  it("fails installation on fetch, status, parse and catalog-less manifests", async () => {
    const cases: (typeof fetch)[] = [
      (async () => {
        throw new TypeError("network");
      }) as typeof fetch,
      (async () => new Response("nope", { status: 500 })) as typeof fetch,
      (async () => new Response("<html>", { status: 200 })) as typeof fetch,
      (async () => jsonResponse({ id: "x", catalogs: [] })) as typeof fetch,
      (async () => jsonResponse({ id: "x" })) as typeof fetch,
    ];
    for (const fetchImpl of cases) {
      const { registry } = registryWith(fetchImpl);
      await expect(registry.install("https://example.test/manifest.json")).rejects.toMatchObject({
        code: "install_failed",
        message: "Could not install this addon.",
      });
    }
  });

  it("never reuses ordinals after removal", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) =>
      jsonResponse(manifest({ id: `addon-${String(input)}` }))) as typeof fetch;
    const { registry } = registryWith(fetchImpl);
    await registry.install("https://one.test/manifest.json");
    const second = await registry.install("https://two.test/manifest.json");
    expect(second.ordinal).toBe(2);
    await registry.remove(1);
    const third = await registry.install("https://three.test/manifest.json");
    expect(third.ordinal).toBe(3);
    expect((await registry.list()).map(addon => addon.ordinal)).toEqual([2, 3]);
  });

  it("persists enabled flags and survives a restart through storage", async () => {
    const storage = memoryStorage();
    const first = registryWith((async () => jsonResponse(manifest())) as typeof fetch, storage);
    await first.registry.install("https://example.test/manifest.json");
    const reloaded = new LocalAddonRegistry({ storage, now: () => 5 });
    const addon = (await reloaded.list())[0];
    expect(addon.id).toBe("com.example.addon");
    await reloaded.setEnabled(addon.ordinal, false);
    const second = new LocalAddonRegistry({ storage, now: () => 6 });
    expect((await second.list())[0].enabled).toBe(false);
  });

  it("falls back to the normalized URL as the addon id", async () => {
    const { registry } = registryWith(
      (async () => jsonResponse(manifest({ id: undefined }))) as typeof fetch,
    );
    const addon = await registry.install("https://example.test/manifest.json");
    expect(addon.id).toBe("https://example.test/manifest.json");
  });

  it("caps the registry and treats corrupt storage as empty", async () => {
    const capped = memoryStorage(
      JSON.stringify({
        version: 1,
        nextOrdinal: 65,
        addons: Array.from({ length: 64 }, (_, index) => ({
          ordinal: index + 1,
          id: `a${index}`,
          manifestUrl: `https://${index}.test/m.json`,
          manifest: manifest(),
          installedAt: 1,
          enabled: true,
        })),
      }),
    );
    const { registry } = registryWith((async () => jsonResponse(manifest())) as typeof fetch, capped);
    await expect(registry.install("https://fresh.test/manifest.json")).rejects.toMatchObject({
      code: "install_failed",
    });
    const corrupt = memoryStorage("{not json");
    const fresh = registryWith((async () => jsonResponse(manifest())) as typeof fetch, corrupt);
    expect(await fresh.registry.list()).toEqual([]);
    const addon = await fresh.registry.install("https://example.test/manifest.json");
    expect(addon.ordinal).toBe(1);
  });

  it("browser storage adapter round-trips through localStorage", async () => {
    const storage = browserStorageSpy();
    const registry = new LocalAddonRegistry({
      storage,
      fetch: (async () => jsonResponse(manifest())) as typeof fetch,
      now: () => 7,
    });
    await registry.install("https://example.test/manifest.json");
    const again = new LocalAddonRegistry({ storage, now: () => 8 });
    expect(await again.list()).toHaveLength(1);
    globalThis.localStorage.removeItem("test.local.registry");
  });

  it("rejects oversize manifests before parsing", async () => {
    const { registry } = registryWith(
      (async () =>
        jsonResponse(manifest(), { "content-length": String(3 * 1024 * 1024) })) as typeof fetch,
    );
    await expect(registry.install("https://example.test/manifest.json")).rejects.toBeInstanceOf(
      LocalRegistryError,
    );
  });
});
