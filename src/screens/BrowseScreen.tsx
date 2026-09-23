import {
  useRef,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import { ChevronDown } from "lucide-react";
import { TvButton, focusElement } from "../ui/remote";
import { AutoLoad } from "../ui/AutoLoad";
import { CARD_SHAPES, type CardShape } from "../ui/cardShapes";
import type { CardRowOptions } from "../components/cards/Cards";
import type { Catalog, MediaItem } from "../api";
import type { ErrorDetail } from "../ui/errors";
import type { Screen } from "../ui/screens";
import {
  catalogFilters,
  catalogFilterLabel,
  discoverTypeGroup,
  discoverGroupLabel,
  catalogsForGroup,
  discoverGroups,
  sameCatalog,
  type CatalogFilter,
} from "../ui/catalogFilters";

type Choice = { label: string; action: () => void };
type ModalSpec = {
  title: string;
  choices: Choice[];
  body?: string;
  message?: string;

  /** Classified failure detail rendered as the dialog's details block. */
  detail?: ErrorDetail;
  /** Choice label that receives focus when the dialog opens. */
  focus?: string;
};
type EntrySpec = {
  title: string;
  initialValue?: string;
  secret?: boolean;
  save: (value: string) => Promise<void>;
};

/** Placeholder tiles while a browse grid waits for its first page. */
function SkeletonCards({ shape }: { shape: CardShape }) {
  return (
    <div className={`cards skeleton-cards ${shape === "poster" ? "poster-grid" : ""}`} aria-hidden="true">
      {Array.from({ length: shape === "poster" ? 12 : 8 }, (_, index) => <div key={index} className="card-skeleton" />)}
    </div>
  );
}

/**
 * Phone Discover controls: one horizontally scrolling chip row each for the
 * content type, the catalogs of that type and the catalog's declared
 * filters. Filter chips open the same choice dialog / text entry as the TV
 * filter buttons, so every catalog extra stays reachable.
 */
function DiscoverChips({
  catalogs,
  catalog,
  catalogValues,
  loadCatalog,
  openFilter,
}: {
  catalogs: readonly Catalog[];
  catalog: Catalog | undefined;
  catalogValues: Record<string, string>;
  loadCatalog: (cat: Catalog) => Promise<void>;
  openFilter: (catalog: Catalog, filter: CatalogFilter) => void;
}) {
  const groups = discoverGroups(catalogs);
  const group = catalog ? discoverTypeGroup(catalog.type) : groups[0];
  const groupCatalogs = group ? catalogsForGroup(catalogs, group) : [];
  // Addon names appear only where two catalogs of one type share a name.
  const nameCounts = new Map<string, number>();
  for (const cat of groupCatalogs) nameCounts.set(cat.name, (nameCounts.get(cat.name) ?? 0) + 1);
  const filters = catalog ? catalogFilters(catalog) : [];
  if (!groups.length) return null;
  return (
    <div className="discover-chips">
      {groups.length > 1 && (
        <div className="chip-row" role="group" aria-label="Content type">
          {groups.map((option) => (
            <button
              type="button"
              key={option}
              className="chip"
              aria-pressed={option === group}
              onClick={() => {
                const first = catalogsForGroup(catalogs, option)[0];
                if (first && option !== group) void loadCatalog(first);
              }}
            >
              {discoverGroupLabel(option)}
            </button>
          ))}
        </div>
      )}
      {groupCatalogs.length > 1 && (
        <div className="chip-row" role="group" aria-label="Catalog">
          {groupCatalogs.map((cat) => (
            <button
              type="button"
              key={`${cat.addonId ?? ""}:${cat.type}:${cat.id}`}
              className="chip"
              aria-pressed={sameCatalog(cat, catalog)}
              onClick={() => { if (!sameCatalog(cat, catalog)) void loadCatalog(cat); }}
            >
              {(nameCounts.get(cat.name) ?? 0) > 1 && cat.addonName ? `${cat.name} · ${cat.addonName}` : cat.name}
            </button>
          ))}
        </div>
      )}
      {catalog && filters.length > 0 && (
        <div className="chip-row" role="group" aria-label="Filters">
          {filters.map((filter) => {
            const value = catalogValues[filter.name]?.trim();
            const label = catalogFilterLabel(filter.name);
            return (
              <button
                type="button"
                key={filter.name}
                className={`chip filter-chip ${!value && filter.required ? "required" : ""}`}
                aria-pressed={!!value}
                aria-label={`${label}: ${value || (filter.required ? "Required" : "Any")}`}
                onClick={() => openFilter(catalog, filter)}
              >
                {value ? `${label}: ${value}` : label}
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The browse screens: Discover (addon-driven type -> catalog -> filters),
 * My List (favorites / continue watching) and Search (query keyboard +
 * grouped results). All data, navigation and modal/entry ownership stay with
 * the App state machine; this component renders what it is given with the
 * DOM contract (class names, focus ids, roles) frozen.
 */
export function BrowseScreen({
  screen,
  responsive,
  phone = false,
  query,
  setQuery,
  searchKey,
  items,
  searchRows,
  navigate,
  catalogs,
  catalog,
  catalogError,
  busy,
  catalogValues,
  loadCatalog,
  setModal,
  setEntry,
  libraryQueue,
  setLibraryQueue,
  queue,
  nextSkip,
  searchPartial,
  cards,
}: {
  screen: Screen;
  responsive: boolean;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  searchKey: MutableRefObject<string>;
  items: readonly MediaItem[];
  searchRows: { name: string; items: readonly MediaItem[]; catalog?: Catalog }[];
  navigate: (next: Screen, catalog?: Catalog) => unknown;
  catalogs: readonly Catalog[];
  catalog: Catalog | undefined;
  catalogError: string;
  busy: boolean;
  catalogValues: Record<string, string>;
  loadCatalog: (
    cat: Catalog,
    skip?: number,
    values?: Record<string, string>,
  ) => Promise<void>;
  setModal: Dispatch<SetStateAction<ModalSpec | undefined>>;
  setEntry: (value: EntrySpec | undefined) => void;
  libraryQueue: boolean;
  setLibraryQueue: Dispatch<SetStateAction<boolean>>;
  queue: readonly MediaItem[];
  nextSkip: number | undefined;
  searchPartial: boolean;
  cards: (list: readonly MediaItem[], prefix: string, options?: CardRowOptions) => ReactNode;
  /** Phone arrangement of the responsive shell. */
  phone?: boolean;
}) {
  // One request per catalog, filter set and page: a page that comes back
  // empty but still reports more must not make the sentinel refetch forever.
  const requestedPage = useRef("");
  const catalogKey = catalog
    ? `${catalog.addonId ?? ""}:${catalog.type}:${catalog.id}:${JSON.stringify(catalogValues)}`
    : "";
  const loadNextPage = () => {
    if (!catalog || nextSkip === undefined) return;
    const key = `${catalogKey}@${nextSkip}`;
    if (requestedPage.current === key) return;
    requestedPage.current = key;
    void loadCatalog(catalog, nextSkip);
  };
  const openFilter = (target: Catalog, filter: CatalogFilter) => {
    const apply = (value: string) => {
      setModal(undefined);
      void loadCatalog(target, 0, {
        ...catalogValues,
        [filter.name]: value,
      });
    };
    if (filter.options.length)
      setModal({
        title: catalogFilterLabel(filter.name),
        choices: [
          ...(!filter.required
            ? [
                {
                  label: "Any",
                  action: () => apply(""),
                },
              ]
            : []),
          ...filter.options.map((value) => ({
            label: value,
            action: () => apply(value),
          })),
        ],
      });
    else
      setEntry({
        title: catalogFilterLabel(filter.name),
        initialValue: catalogValues[filter.name] ?? "",
        save: async (value) => {
          if (filter.required && !value.trim())
            throw new Error(
              "Enter a value for this required filter.",
            );
          setEntry(undefined);
          apply(value.trim());
        },
      });
  };
  const listItems = screen === "My List" && libraryQueue ? queue : items;
  // Search status leads the results in the responsive shell (the TV keeps
  // its fixed slot below them); an empty result says so once, not twice.
  const searchStatus = screen === "Search" && (!responsive || busy || !query.trim() || items.length > 0) && (
    <p className="search-status" role="status">
      {busy
        ? "Searching…"
        : query.trim()
          ? `${items.length} ${items.length === 1 ? "result" : "results"}`
          : "Find your next favorite."}
      {searchPartial ? " Some sources couldn't load." : ""}
    </p>
  );
  const layout = phone ? "phone" : "desktop";
  const gridShape: CardShape =
    screen === "Discover"
      ? CARD_SHAPES.discover[layout]
      : libraryQueue
        ? CARD_SHAPES.continueWatching
        : CARD_SHAPES.myList;
  return (
    <main className={`browse ${screen === "Search" ? "search" : ""}`}>
      <h1>{screen}</h1>
      {screen === "Search" && (
        <div
          className="keyboard"
          onFocusCapture={(event) => {
            const id = (event.target as HTMLElement).dataset.focusId;
            if (id?.startsWith("key-")) searchKey.current = id;
          }}
          onKeyDown={(event) => {
            const id =
              (event.target as HTMLElement).dataset.focusId ?? "";
            const index =
              "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".indexOf(
                id.replace("key-", ""),
              );
            if (
              items.length &&
              (["MediaPlay", "MediaPlayPause"].includes(event.key) ||
                (event.key === "ArrowRight" &&
                  index >= 0 &&
                  index % 6 === 5))
            ) {
              event.preventDefault();
              event.stopPropagation();
              focusElement("result-0");
            }
          }}
        >
          <input
            tabIndex={responsive ? 0 : -1}
            maxLength={256}
            aria-label="Search titles"
            placeholder="Search movies and shows"
            onKeyDown={(e) => {
              if (
                (responsive ? ["Enter"] : ["Enter", "ArrowRight", "MediaPlay"]).includes(e.key) &&
                items.length
              ) {
                e.preventDefault();
                e.stopPropagation();
                focusElement("result-0");
              }
            }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div>
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
              .split("")
              .map((c) => (
                <TvButton
                  id={`key-${c}`}
                  key={c}
                  onActivate={() =>
                    setQuery((q) => (q + c).slice(0, 256))
                  }
                >
                  {c.toLowerCase()}
                </TvButton>
              ))}
          </div>
          <TvButton
            id="space"
            aria-label="Space"
            onActivate={() =>
              setQuery((q) => (q + " ").slice(0, 256))
            }
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 12v4h18v-4" />
            </svg>
          </TvButton>
          <TvButton
            id="delete"
            aria-label="Delete"
            onActivate={() => setQuery((q) => q.slice(0, -1))}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 6h13v12H8l-6-6zM11 9l6 6m0-6-6 6" />
            </svg>
          </TvButton>
          <TvButton
            id="clear"
            aria-label="Clear"
            onActivate={() => setQuery("")}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M5 6h14M9 6V3h6v3M7 6v15h10V6M10 9v9m4-9v9" />
            </svg>
          </TvButton>
          <p className="search-help">
            Type here or use your remote app. Play/Pause opens
            results.
          </p>
        </div>
      )}
      {screen === "Discover" && <>
        {catalogError && <div className="catalog-status" role="alert"><p>{catalogError}</p><button onClick={() => void navigate("Discover")}>Retry catalogs</button></div>}
        {!busy && !catalogError && !catalogs.length && <p className="catalog-status">No catalogs are available. Add or enable a catalog addon in Settings.</p>}
      </>}
      {screen === "Discover" && phone && (
        <DiscoverChips
          catalogs={catalogs}
          catalog={catalog}
          catalogValues={catalogValues}
          loadCatalog={(cat) => loadCatalog(cat)}
          openFilter={openFilter}
        />
      )}
      {screen === "Discover" && !phone && (
        <div className="filters">
          <TvButton
            id="discover-type"
            onActivate={() =>
              setModal({
                title: "Content type",
                choices: discoverGroups(catalogs).map((group) => ({
                  label: discoverGroupLabel(group),
                  action: () => {
                    setModal(undefined);
                    const first = catalogsForGroup(catalogs, group)[0];
                    if (first) void loadCatalog(first);
                  },
                })),
              })
            }
          >
            {catalog ? discoverGroupLabel(discoverTypeGroup(catalog.type)) : "Content type"}
          </TvButton>
          <TvButton
            id="discover-catalog"
            onActivate={() =>
              setModal({
                title: "Catalog",
                choices: (catalog
                  ? catalogsForGroup(catalogs, discoverTypeGroup(catalog.type))
                  : catalogs.filter((c) => c.type !== "live")
                ).map((cat) => ({
                  label: `${cat.addonName ? `${cat.addonName} · ` : ""}${cat.name}`,
                  action: () => {
                    setModal(undefined);
                    void loadCatalog(cat);
                  },
                })),
              })
            }
          >
            {catalog ? `${catalog.addonName ? `${catalog.addonName} · ` : ""}${catalog.name}` : "Catalog"}
          </TvButton>
          {catalog &&
            catalogFilters(catalog).map((filter) => (
              <TvButton
                key={filter.name}
                id={`discover-filter-${filter.name}`}
                onActivate={() => openFilter(catalog, filter)}
              >
                {catalogFilterLabel(filter.name)}:{" "}
                {catalogValues[filter.name] ||
                  (filter.required ? "Required" : "Any")}
              </TvButton>
            ))}
        </div>
      )}
      {screen === "My List" && responsive && (
        <div className="segmented" role="group" aria-label="Library">
          <button type="button" aria-pressed={!libraryQueue} onClick={() => setLibraryQueue(false)}>
            My List
          </button>
          <button type="button" aria-pressed={libraryQueue} onClick={() => setLibraryQueue(true)}>
            Continue Watching
          </button>
        </div>
      )}
      {screen === "My List" && !responsive && (
        <div className="filters">
          <TvButton
            id="library-list"
            onActivate={() => setLibraryQueue(false)}
          >
            My List
          </TvButton>
          <TvButton
            id="library-queue"
            onActivate={() => setLibraryQueue(true)}
          >
            Continue Watching
          </TvButton>
        </div>
      )}
      {responsive && searchStatus}
      <div className="result-grid">
        {screen === "Search"
          ? searchRows
              .filter((row) => row.items.length)
              .map((row, i) => (
                <section key={`${row.name}-${i}`}>
                  <h2>{row.name}</h2>
                  {cards(
                    row.items,
                    i === 0 ? "result" : `search-${i}`,
                    { shape: CARD_SHAPES.search[layout], catalog: row.catalog },
                  )}
                </section>
              ))
          : responsive && busy && !listItems.length && screen === "Discover"
            ? <SkeletonCards shape={gridShape} />
            : cards(listItems, "result", { shape: gridShape, catalog: screen === "Discover" ? catalog : undefined })}
        {/* Reaching the end of a paged catalog loads its next page; there is
            no Load more control on any layout. */}
        {screen === "Discover" && catalog && nextSkip !== undefined && (
          <AutoLoad
            onLoad={loadNextPage}
            disabled={busy}
            generation={items.length}
          />
        )}
        {screen === "Discover" && busy && items.length > 0 && (
          <p className="load-status" role="status">Loading more titles…</p>
        )}
        {!busy &&
          !listItems.length &&
          !(screen === "Discover" && catalogError) &&
          (screen !== "Search" || !!query.trim()) && (
            <p className="browse-empty">
              {screen === "Discover" &&
              catalog &&
              catalogFilters(catalog).some(
                (f) => f.required && !catalogValues[f.name]?.trim(),
              )
                ? "Choose the required filters to browse this catalog."
                : query
                  ? "No matching titles"
                  : screen === "My List"
                    ? libraryQueue
                      ? "Nothing in progress. Titles you start watching appear here."
                      : "Your list is empty. Add titles with the + button."
                    : "No titles yet"}
            </p>
          )}
      </div>
      {!responsive && searchStatus}
    </main>
  );
}
