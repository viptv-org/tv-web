/* Local addon mode shell (design-contract/LOCAL_MODE.md): account-free
   browsing from the on-device addon registry. Self-contained on purpose —
   the account app's profile/queue/session ladder stays untouched. Reuses
   the responsive shelf/grid styles; TV spatial focus is recorded pending in
   TESTING.md. Local playback (LM-004) is not part of this revision. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserLocalRegistryStorage,
  LocalAddonRegistry,
  LocalDiscovery,
  LocalRegistryError,
} from "../local";
import type { Catalog, MediaItem } from "../api";
import { exitLocalMode } from "../local/mode";
import { AutoLoad } from "./AutoLoad";
import "./local.css";

type Page =
  | { kind: "home" }
  | { kind: "addons" }
  | { kind: "browse"; catalog: Catalog };

const MAX_HOME_SHELVES = 12;

function describeError(error: unknown): string {
  if (error instanceof LocalRegistryError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function genreOptions(catalog: Catalog): string[] {
  const genre = catalog.extras?.find(extra => extra.name === "genre");
  return Array.isArray(genre?.options) ? genre.options : [];
}

function addonName(addon: { id: string; manifest: { name?: unknown } }): string {
  return typeof addon.manifest.name === "string" && addon.manifest.name.trim()
    ? addon.manifest.name
    : addon.id;
}

export function LocalApp({ onExit, fetch: fetchImpl }: { onExit: () => void; fetch?: typeof fetch }) {
  const [page, setPage] = useState<Page>({ kind: "home" });
  const [catalogs, setCatalogs] = useState<readonly Catalog[]>([]);
  const [shelves, setShelves] = useState<
    readonly { catalog: Catalog; items: readonly MediaItem[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { registry, discovery } = useMemo(() => {
    // Native hosts inject a CORS-free fetch (design LM-006); the browser
    // falls back to the webview's fetch with normal CORS rules.
    const registry = new LocalAddonRegistry({
      storage: new BrowserLocalRegistryStorage(),
      fetch: fetchImpl,
    });
    return { registry, discovery: new LocalDiscovery(registry, { fetch: fetchImpl }) };
  }, [fetchImpl]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const available = await discovery.catalogs();
      setCatalogs(available);
      const rows = await Promise.all(
        available.slice(0, MAX_HOME_SHELVES).map(async catalog => {
          try {
            const first = await discovery.discover({
              type: catalog.type,
              catalog: catalog.id,
              addonId: catalog.addonId ?? undefined,
            });
            return { catalog, items: first.items };
          } catch {
            return { catalog, items: [] as readonly MediaItem[] };
          }
        }),
      );
      setShelves(rows.filter(row => row.items.length > 0));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, [discovery]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const exit = () => {
    exitLocalMode();
    onExit();
  };

  return (
    <section className="responsive-app local-app" aria-label="viptv local mode">
      <header className="local-header">
        <h1>viptv</h1>
        <p className="local-tag">Local mode — addons on this device only.</p>
        <nav>
          <button type="button" onClick={() => setPage({ kind: "home" })} aria-current={page.kind === "home" ? "page" : undefined}>Home</button>
          <button type="button" onClick={() => setPage({ kind: "addons" })} aria-current={page.kind === "addons" ? "page" : undefined}>Addons</button>
          <button type="button" onClick={exit}>Sign in to an account</button>
        </nav>
      </header>
      <div className="tv-screen responsive-app">
        {page.kind === "addons" ? (
          <LocalAddons registry={registry} onChanged={reload} />
        ) : page.kind === "browse" ? (
          <LocalBrowse catalog={page.catalog} discovery={discovery} />
        ) : loading ? (
          <p role="status" className="local-status">Loading your addons…</p>
        ) : error ? (
          <div className="local-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void reload()}>Retry</button>
          </div>
        ) : shelves.length === 0 ? (
          <div className="local-empty">
            <p>Install an addon to start browsing.</p>
            <button type="button" onClick={() => setPage({ kind: "addons" })}>Add an addon</button>
          </div>
        ) : (
          <div className="shelves">
            {shelves.map(row => (
              <section key={`${row.catalog.addonId}-${row.catalog.id}-${row.catalog.type}`} className="shelf" aria-label={row.catalog.name}>
                <div className="shelf-heading">
                  <h2>{row.catalog.name}</h2>
                  <button type="button" className="shelf-see-more" onClick={() => setPage({ kind: "browse", catalog: row.catalog })}>
                    more &gt;
                  </button>
                </div>
                <div className="local-cards">
                  {row.items.slice(0, 24).map(item => (
                    <figure key={`${item.type}-${item.id}`} className="local-card">
                      {item.poster ? <img src={item.poster} alt="" loading="lazy" /> : null}
                      <figcaption>{item.name}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LocalBrowse({
  catalog,
  discovery,
}: {
  catalog: Catalog;
  discovery: LocalDiscovery;
}) {
  const [items, setItems] = useState<readonly MediaItem[]>([]);
  const [nextSkip, setNextSkip] = useState<number>();
  const [genre, setGenre] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading catalog…");
  const [appending, setAppending] = useState(false);
  const scope = useRef<AbortController>();

  useEffect(() => () => scope.current?.abort(), []);
  useEffect(() => {
    const load = async () => {
      scope.current?.abort();
      const controller = new AbortController();
      scope.current = controller;
      setStatus("Loading catalog…");
      try {
        const page = await discovery.discover(
          {
            type: catalog.type,
            catalog: catalog.id,
            addonId: catalog.addonId ?? undefined,
            skip: 0,
            genre: genre || undefined,
            search: search.trim() || undefined,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setItems(page.items);
        setNextSkip(page.hasMore ? (page.nextSkip ?? undefined) : undefined);
        setStatus(page.items.length ? "" : "This catalog returned nothing to show.");
      } catch (cause) {
        if (!controller.signal.aborted) {
          setItems([]);
          setNextSkip(undefined);
          setStatus(describeError(cause));
        }
      }
    };
    void load();
  }, [catalog, discovery, genre, search]);

  const genres = genreOptions(catalog);
  const supportsSearch = catalog.extras?.some(extra => extra.name === "search") ?? false;

  return (
    <section className="local-browse" aria-label={catalog.name}>
      <div className="filters">
        <h2>{`${catalog.addonName ? `${catalog.addonName} · ` : ""}${catalog.name}`}</h2>
        {genres.length > 0 && (
          <label>
            Genre
            <select value={genre} onChange={event => setGenre(event.target.value)}>
              <option value="">Any</option>
              {genres.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        )}
        {supportsSearch && (
          <label>
            Search
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search this catalog"
              maxLength={256}
            />
          </label>
        )}
      </div>
      {status && <p role="status" className="local-status">{status}</p>}
      <div className="result-grid local-grid">
        {items.map(item => (
          <figure key={`${item.type}-${item.id}`} className="local-card">
            {item.poster ? <img src={item.poster} alt="" loading="lazy" /> : null}
            <figcaption>{item.name}</figcaption>
          </figure>
        ))}
      </div>
      {/* The end of the grid loads the next page; there is no Load more control. */}
      {nextSkip !== undefined && (
        <AutoLoad
          generation={items.length}
          disabled={appending}
          onLoad={() => {
            const controller = scope.current;
            setAppending(true);
            void discovery.discover({
              type: catalog.type,
              catalog: catalog.id,
              addonId: catalog.addonId ?? undefined,
              skip: nextSkip,
              genre: genre || undefined,
              search: search.trim() || undefined,
            }).then(page => {
              if (controller?.signal.aborted) return;
              setItems(previous => [...previous, ...page.items]);
              // A page that adds nothing ends paging instead of refetching the same offset.
              setNextSkip(page.hasMore && page.items.length ? (page.nextSkip ?? undefined) : undefined);
            }).catch(() => {
              if (!controller?.signal.aborted) setNextSkip(undefined);
            }).finally(() => setAppending(false));
          }}
        />
      )}
    </section>
  );
}

function LocalAddons({
  registry,
  onChanged,
}: {
  registry: LocalAddonRegistry;
  onChanged: () => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [addons, setAddons] = useState<Awaited<ReturnType<LocalAddonRegistry["list"]>>>([]);
  const [pending, setPending] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [confirming, setConfirming] = useState<{ ordinal: number; name: string }>();

  const refresh = useCallback(async () => {
    setAddons(await registry.list());
  }, [registry]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const install = async () => {
    if (pending) return;
    setPending(true);
    setEntryError("");
    try {
      await registry.install(url);
      setUrl("");
      await refresh();
      await onChanged();
    } catch (cause) {
      setEntryError(describeError(cause));
    } finally {
      setPending(false);
    }
  };

  const toggle = async (ordinal: number, enabled: boolean) => {
    await registry.setEnabled(ordinal, enabled);
    await refresh();
    await onChanged();
  };

  const remove = async (ordinal: number) => {
    setConfirming(undefined);
    await registry.remove(ordinal);
    await refresh();
    await onChanged();
  };

  return (
    <section className="local-addons" aria-label="Manage addons">
      <h2>Addons</h2>
      <form
        onSubmit={event => {
          event.preventDefault();
          void install();
        }}
      >
        <label htmlFor="local-addon-url">Addon manifest URL</label>
        <input
          id="local-addon-url"
          value={url}
          onChange={event => setUrl(event.target.value)}
          placeholder="https://example.test/manifest.json"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={2048}
        />
        <button type="submit" disabled={pending || !url.trim()}>
          {pending ? "Installing…" : "Install addon"}
        </button>
      </form>
      {entryError && <p className="local-error-text" role="alert">{entryError}</p>}
      {addons.length === 0 ? (
        <p className="local-status">No addons installed yet.</p>
      ) : (
        <ul className="local-addon-list">
          {addons.map(addon => (
            <li key={addon.ordinal} className={addon.enabled ? "" : "disabled"}>
              <span className="local-addon-name">{addonName(addon)}</span>
              <span className="local-addon-id">{addon.id}</span>
              <button type="button" onClick={() => void toggle(addon.ordinal, !addon.enabled)}>
                {addon.enabled ? "Disable" : "Enable"}
              </button>
              <button type="button" onClick={() => setConfirming({ ordinal: addon.ordinal, name: addonName(addon) })}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirming && (
        <div className="local-confirm" role="dialog" aria-modal="true" aria-label={`Remove ${confirming.name}`}>
          <p>{`Remove ${confirming.name}? Its catalogs leave this device.`}</p>
          <button type="button" onClick={() => void remove(confirming.ordinal)}>Remove</button>
          <button type="button" onClick={() => setConfirming(undefined)}>Cancel</button>
        </div>
      )}
    </section>
  );
}
