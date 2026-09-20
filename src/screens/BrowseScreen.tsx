import {
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import { TvButton, focusElement } from "../ui/remote";
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
  searchRows: { name: string; items: readonly MediaItem[] }[];
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
  cards: (list: readonly MediaItem[], prefix: string) => ReactNode;
}) {
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
      {screen === "Discover" && (
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
                onActivate={() => {
                  const apply = (value: string) => {
                    setModal(undefined);
                    void loadCatalog(catalog, 0, {
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
                }}
              >
                {catalogFilterLabel(filter.name)}:{" "}
                {catalogValues[filter.name] ||
                  (filter.required ? "Required" : "Any")}
              </TvButton>
            ))}
        </div>
      )}
      {screen === "My List" && (
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
                  )}
                </section>
              ))
          : cards(
              screen === "My List" && libraryQueue ? queue : items,
              "result",
            )}
        {screen === "Discover" &&
          catalog &&
          nextSkip !== undefined && (
            <TvButton
              id="discover-more"
              onActivate={() => void loadCatalog(catalog, nextSkip)}
            >
              Load more
            </TvButton>
          )}
        {!busy &&
          !items.length &&
          (screen !== "Search" || !!query.trim()) && (
            <p>
              {screen === "Discover" &&
              catalog &&
              catalogFilters(catalog).some(
                (f) => f.required && !catalogValues[f.name]?.trim(),
              )
                ? "Choose the required filters to browse this catalog."
                : query
                  ? "No matching titles"
                  : "No titles yet"}
            </p>
          )}
      </div>
      {screen === "Search" && (
        <p className="search-status" role="status">
          {busy
            ? "Searching…"
            : query.trim()
              ? `${items.length} results`
              : "Find your next favorite."}
          {searchPartial ? " Some sources couldn't load." : ""}
        </p>
      )}
    </main>
  );
}
