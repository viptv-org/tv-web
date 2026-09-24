/* Local addon mode shell (design-contract/LOCAL_MODE.md): account-free
   browsing from the on-device addon registry. Self-contained on purpose —
   the account app's profile/queue/session ladder stays untouched. TV spatial
   focus is recorded pending in TESTING.md. Local playback (LM-004) is not
   part of this revision.
   Design references: PhLocalHome, WebLocalHome, WebLocalLoading, WebLocalEmpty,
   WebLocalAddons, WebLocalRemove. Styles: src/styles/screens/settings.css (.vx-local-*). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, CircleAlert, Puzzle, Trash2 } from "lucide-react";
import {
  BrowserLocalRegistryStorage,
  LocalAddonRegistry,
  LocalDiscovery,
  LocalRegistryError,
} from "../local";
import type { Catalog, MediaItem } from "../api";
import { exitLocalMode } from "../local/mode";
import { AutoLoad } from "./AutoLoad";
import { EmptyState, Skel, StatusLine } from "./primitives/Feedback";
import { TextField } from "./primitives/Fields";
import { ButtonContent, buttonClass } from "./primitives/Button";
import { Dialog, DialogText } from "./primitives/Overlays";
import { SettingsLayer } from "./SettingsOverlay";

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

  const navItem = (kind: "home" | "addons", label: string) => (
    <button
      type="button"
      className="vx-local__nav-item"
      onClick={() => setPage({ kind })}
      aria-current={page.kind === kind ? "page" : undefined}
    >
      {label}
    </button>
  );

  return (
    <section className="responsive-app local-app vx-local" aria-label="viptv local mode">
      <header className="vx-local__header">
        <h1 className="vx-local__wordmark">viptv</h1>
        <p className="vx-local__tag">Local mode — addons on this device only.</p>
        <nav className="vx-local__nav" aria-label="Local mode">
          {navItem("home", "Home")}
          {navItem("addons", "Addons")}
        </nav>
        <button type="button" className="vx-local__exit" onClick={exit}>Sign in to an account</button>
      </header>
      <div className="tv-screen responsive-app vx-local__screen">
        {page.kind === "addons" ? (
          <LocalAddons registry={registry} onChanged={reload} />
        ) : page.kind === "browse" ? (
          <LocalBrowse catalog={page.catalog} discovery={discovery} />
        ) : loading ? (
          <div className="vx-local__page vx-local__shelves">
            <StatusLine>Loading your addons…</StatusLine>
            {[0, 1].map(row => (
              <section className="vx-local__shelf" key={row} aria-hidden="true">
                <Skel className="vx-local__skel-title" />
                <div className="vx-local__cards">
                  {Array.from({ length: 7 }, (_, index) => <Skel key={index} className="vx-local__skel-poster" />)}
                </div>
              </section>
            ))}
          </div>
        ) : error ? (
          <div className="vx-local__page vx-local__notice">
            <EmptyState
              icon={<CircleAlert strokeWidth={2} />}
              title={error}
              action={<button type="button" className={buttonClass({ kind: "light", size: "pill" })} onClick={() => void reload()}>Try again</button>}
            />
          </div>
        ) : shelves.length === 0 ? (
          <div className="vx-local__page vx-local__notice">
            <EmptyState
              icon={<Puzzle strokeWidth={2} />}
              title="Install an addon to start browsing."
              action={<button type="button" className={buttonClass({ kind: "light", size: "pill" })} onClick={() => setPage({ kind: "addons" })}>Add an addon</button>}
            />
          </div>
        ) : (
          <div className="vx-local__page vx-local__shelves">
            {shelves.map(row => (
              <section key={`${row.catalog.addonId}-${row.catalog.id}-${row.catalog.type}`} className="vx-local__shelf" aria-labelledby={`local-shelf-${row.catalog.addonId}-${row.catalog.id}-${row.catalog.type}`}>
                <div className="vx-local__shelf-head">
                  <h2 className="vx-local__shelf-title" id={`local-shelf-${row.catalog.addonId}-${row.catalog.id}-${row.catalog.type}`}>{row.catalog.name}</h2>
                  <button
                    type="button"
                    className="vx-local__more"
                    aria-label={`More from ${row.catalog.name}`}
                    onClick={() => setPage({ kind: "browse", catalog: row.catalog })}
                  >
                    more
                    <ChevronRight aria-hidden="true" strokeWidth={2.4} />
                  </button>
                </div>
                <div className="vx-local__cards">
                  {row.items.slice(0, 24).map(item => <LocalCard key={`${item.type}-${item.id}`} item={item} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** A poster and its title (no local playback yet, so the card opens nothing). */
function LocalCard({ item }: { item: MediaItem }) {
  return (
    <figure className="vx-local__card">
      <span className="vx-local__poster">{item.poster ? <img src={item.poster} alt="" loading="lazy" /> : null}</span>
      <figcaption className="vx-local__card-title">{item.name}</figcaption>
    </figure>
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
    <section className="vx-local__page vx-local__browse" aria-labelledby="local-browse-title">
      <div className="vx-local__filters">
        <h2 className="vx-local__browse-title" id="local-browse-title">{`${catalog.addonName ? `${catalog.addonName} · ` : ""}${catalog.name}`}</h2>
        {genres.length > 0 && (
          <label className="vx-field vx-local__select">
            <span className="vx-field__label">Genre</span>
            <span className="vx-field__control">
              <select className="vx-field__input" value={genre} onChange={event => setGenre(event.target.value)}>
                <option value="">Any</option>
                {genres.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </span>
          </label>
        )}
        {supportsSearch && (
          <TextField
            className="vx-local__search"
            label="Search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search this catalog"
            maxLength={256}
          />
        )}
      </div>
      {status && <p role="status" className="vx-local__status">{status}</p>}
      <div className="vx-local__grid">
        {items.map(item => <LocalCard key={`${item.type}-${item.id}`} item={item} />)}
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
    <section className="vx-local__page vx-local__addons" aria-label="Manage addons">
      <h2 className="vx-sr-only">Addons</h2>
      <form
        className="vx-local__install"
        onSubmit={event => {
          event.preventDefault();
          void install();
        }}
      >
        <TextField
          id="local-addon-url"
          label="Addon manifest URL"
          mono={Boolean(url)}
          value={url}
          onChange={event => setUrl(event.target.value)}
          placeholder="https://example.test/manifest.json"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={2048}
          error={entryError || undefined}
          errorIcon={<CircleAlert aria-hidden="true" strokeWidth={2.2} />}
        />
        <button type="submit" className={buttonClass({ kind: "primary", icon: pending })} disabled={pending} aria-busy={pending || undefined}>
          <ButtonContent loading={pending} loadingLabel="Installing…">Install addon</ButtonContent>
        </button>
      </form>
      {addons.length === 0 ? (
        <p className="vx-local__status">No addons installed yet.</p>
      ) : (
        <ul className="vx-settings-card vx-local__list">
          {addons.map(addon => (
            <li key={addon.ordinal} className="vx-local__addon">
              <span className="vx-local__addon-icon" aria-hidden="true"><Puzzle strokeWidth={2} /></span>
              <span className="vx-local__addon-text">
                <span className="vx-local__addon-name">{addonName(addon)}</span>
                <span className="vx-local__addon-id">{addon.id}</span>
              </span>
              <button type="button" className={buttonClass({ size: "small" })} onClick={() => void toggle(addon.ordinal, !addon.enabled)}>
                {addon.enabled ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                className={buttonClass({ kind: "destructive", size: "small", icon: true })}
                data-focus-id={`local-remove-${addon.ordinal}`}
                onClick={() => setConfirming({ ordinal: addon.ordinal, name: addonName(addon) })}
              >
                <ButtonContent icon={<Trash2 aria-hidden="true" strokeWidth={2.2} />}>Remove</ButtonContent>
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirming && (
        <SettingsLayer
          className="vx-local__layer"
          onClose={() => setConfirming(undefined)}
          initialFocus="local-remove-cancel"
          returnFocus={`local-remove-${confirming.ordinal}`}
        >
          <Dialog
            title={`Remove ${confirming.name}?`}
            onClose={() => setConfirming(undefined)}
            actions={
              <>
                <button type="button" data-focus-id="local-remove-cancel" className={buttonClass({ block: true })} onClick={() => setConfirming(undefined)}>Cancel</button>
                <button type="button" className={buttonClass({ kind: "destructive", block: true, icon: true })} onClick={() => void remove(confirming.ordinal)}>
                  <ButtonContent icon={<Trash2 aria-hidden="true" strokeWidth={2.2} />}>Remove</ButtonContent>
                </button>
              </>
            }
          >
            <DialogText>Its catalogs leave this device.</DialogText>
          </Dialog>
        </SettingsLayer>
      )}
    </section>
  );
}
