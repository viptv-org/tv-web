import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Compass,
  Delete,
  Plus,
  Search as SearchIcon,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Space,
  Trash2,
  X,
} from "lucide-react";
import { TvButton, focusElement } from "../ui/remote";
import { AutoLoad } from "../ui/AutoLoad";
import { CARD_SHAPES, type CardShape } from "../ui/cardShapes";
import type { CardRowOptions } from "../components/cards/Cards";
import type { Catalog, MediaItem, TvProfile } from "../api";
import type { ErrorDetail } from "../ui/errors";
import type { Screen } from "../ui/screens";
import { isDesktopShell, type Choice, type ModalView } from "../ui/app/appShared";
import { ReadyImage } from "../ui/RokuArtwork";
import { avatarUrl } from "../ui/ProfileEditor";
import { ChipDivider } from "../ui/primitives/Chips";
import { FieldValue } from "../ui/primitives/Fields";
import { KeyLegend, type LegendItem } from "../ui/primitives/Keys";
import { LoadingMore, SkeletonTile } from "../ui/primitives/Feedback";
import {
  catalogChipLabels,
  catalogChoiceLabel,
  catalogFilterLabel,
  catalogFilterSummary,
  catalogFilters,
  catalogsForGroup,
  discoverGroupLabel,
  discoverGroups,
  discoverTypeGroup,
  sameCatalog,
  searchSections,
  type CatalogFilter,
  type DiscoverGroup,
  type SearchSection,
  type SearchSectionKey,
} from "../ui/catalogFilters";

/*
 * Browse family: Discover, My List and Search on every platform.
 * Reference screens (design/viptv-design-system/reference/screens):
 *   phone    Discover, PhDiscoverFilter, PhFilterText, Library, PhLibraryCW, PhSearch, PhSearchBlank
 *   desktop  DeskDiscover, DeskDiscoverCatalog, DeskDiscoverFilter, DeskLibrary, DeskLibraryCW, WebSearch
 *   TV       TvDiscover, TvDiscoverFilter, TvFilterText, TvLibrary, TvSearch
 * Styles: src/styles/screens/browse.css (vx-browse-…).
 *
 * Choice lists (catalog, filter values) go through the App's generic modal
 * with a `choices` view: a phone bottom sheet, a desktop popover anchored
 * under its chip, a TV right panel. Text filters open the shared TextEntry.
 * Data, navigation, paging and modal / entry ownership stay with the App
 * state machine; this component renders what it is given.
 */

type ModalSpec = {
  title: string;
  choices: Choice[];
  body?: string;
  message?: string;

  /** Classified failure detail rendered as the dialog's details block. */
  detail?: ErrorDetail;
  /** Choice label that receives focus when the dialog opens. */
  focus?: string;
  /** Presentation hint (value list; desktop popover anchor). */
  view?: ModalView;
  /** Family-scoped modifier on the dialog / popover (browse.css popover widths). */
  className?: string;
};
type EntrySpec = {
  title: string;
  initialValue?: string;
  secret?: boolean;
  save: (value: string) => Promise<void>;
};

const KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
const KEY_COLUMNS = 6;
const BACK_KEYS = ["Escape", "BrowserBack", "GoBack"];
const BACK_CODES = [10009, 461];
/** Room kept around a TV-focused control inside a clipping viewport (4 px ring + scale). */

/** A desktop popover anchored under its control (DeskDiscoverCatalog / DeskDiscoverFilter: 8 px below). */
function anchorUnder(element: Element | null | undefined): ModalView["anchor"] {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  if (!rect.width && !rect.height) return undefined;
  return { x: rect.left, y: rect.bottom + 8, align: "start" };
}

/** Empty / status block (feedback primitive markup): 52 / 60 / 88 icon disc, optional title, one line. */
function BrowseEmpty({ icon, title, children, action, center, alert, className }: {
  icon: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  center?: boolean;
  alert?: boolean;
  className?: string;
}) {
  return (
    <div
      className={["vx-empty", center ? "vx-empty--center" : "", "vx-browse__empty", className ?? ""].filter(Boolean).join(" ")}
      role={alert ? "alert" : undefined}
    >
      <span className="vx-empty__icon" aria-hidden="true">{icon}</span>
      {title ? <h2 className="vx-empty__title">{title}</h2> : null}
      {children ? <p className="vx-empty__text">{children}</p> : null}
      {action ? <div className="vx-empty__action">{action}</div> : null}
    </div>
  );
}

/** Dropdown chip content: "Genre: Any ⌄", "Genre: Comedy ⌄", or "Year  Required ⌄". */
function FilterChipContent({ filter, value }: { filter: CatalogFilter; value: string }) {
  const label = catalogFilterLabel(filter.name);
  return (
    <>
      {value || !filter.required ? (
        <>
          <span className="vx-chip__key">{label}:</span>
          <span className="vx-browse__chip-value">{value || "Any"}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <span className="vx-chip__tag">Required</span>
        </>
      )}
      <ChevronDown aria-hidden="true" strokeWidth={2.2} />
    </>
  );
}

/** Phone My List: the profile row above the segments (Library). */
function ProfileSwitch({ profile, onProfiles }: { profile: TvProfile; onProfiles: () => void }) {
  return (
    <button
      type="button"
      className="vx-browse__profile"
      aria-label={`Switch profile, current: ${profile.name}`}
      onClick={onProfiles}
    >
      <span className="vx-browse__profile-avatar" aria-hidden="true">
        <span>{profile.name.trim().slice(0, 1).toUpperCase()}</span>
        <ReadyImage src={avatarUrl(profile)} alt="" />
      </span>
      <span className="vx-browse__profile-text">
        <span className="vx-browse__profile-name">{profile.name}</span>
        <span className="vx-browse__profile-note">Switch profile</span>
      </span>
      <ChevronDown aria-hidden="true" strokeWidth={2} />
    </button>
  );
}

/**
 * One search result section: heading + count, and on desktop "See all" (the
 * section's type filter) plus chevrons that page the row sideways.
 */
function SearchSectionView({
  section,
  index,
  layout,
  responsive,
  phone,
  grid,
  onSeeAll,
  cards,
}: {
  section: SearchSection;
  index: number;
  layout: "phone" | "desktop";
  responsive: boolean;
  phone: boolean;
  /** Desktop type filter: the section fills a wrapping grid. */
  grid: boolean;
  onSeeAll?: () => void;
  cards: (list: readonly MediaItem[], prefix: string, options?: CardRowOptions) => ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const controls = responsive && !phone && !grid;
  useEffect(() => {
    if (!controls) return;
    const scroller = row.current?.querySelector<HTMLElement>(".cards");
    if (!scroller) return;
    const read = () =>
      setEdges((previous) => {
        const next = {
          left: scroller.scrollLeft > 4,
          right: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4,
        };
        return previous.left === next.left && previous.right === next.right ? previous : next;
      });
    read();
    scroller.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      scroller.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [controls, section.items]);
  const page = (direction: 1 | -1) => {
    const scroller = row.current?.querySelector<HTMLElement>(".cards");
    const first = scroller?.firstElementChild as HTMLElement | null;
    if (!scroller) return;
    const pitch = first ? first.offsetWidth + (parseFloat(getComputedStyle(scroller).columnGap) || 0) : scroller.clientWidth;
    const step = Math.max(1, Math.floor(scroller.clientWidth / pitch)) * pitch;
    scroller.scrollBy({ left: direction * step, behavior: "instant" as ScrollBehavior });
  };
  const titleId = `search-section-${section.key}`;
  const count = section.items.length;
  return (
    <section className="vx-browse__section" aria-labelledby={titleId} data-section={section.key}>
      <div className="vx-browse__section-head">
        <span className="vx-browse__section-name">
          <h2 className="vx-browse__section-title" id={titleId}>{section.title}</h2>
          {!phone && (
            <span className="vx-browse__section-count">
              {responsive ? count : `${count} ${count === 1 ? "result" : "results"}`}
            </span>
          )}
        </span>
        {controls && (
          <span className="vx-browse__section-tools">
            {onSeeAll && (edges.left || edges.right) && (
              <button type="button" className="vx-link vx-link--plain" onClick={onSeeAll}>
                See all
              </button>
            )}
            {(edges.left || edges.right) && (
              <>
                <button
                  type="button"
                  className="vx-btn vx-btn--icon vx-browse__row-nav"
                  aria-label={`Scroll ${section.title} left`}
                  disabled={!edges.left}
                  onClick={() => page(-1)}
                >
                  <ChevronLeft aria-hidden="true" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="vx-btn vx-btn--icon vx-browse__row-nav"
                  aria-label={`Scroll ${section.title} right`}
                  disabled={!edges.right}
                  onClick={() => page(1)}
                >
                  <ChevronRight aria-hidden="true" strokeWidth={2.2} />
                </button>
              </>
            )}
          </span>
        )}
      </div>
      <div className={grid ? "vx-browse__grid vx-browse__grid--poster" : "vx-browse__row"} ref={row}>
        {cards(section.items, index === 0 ? "result" : `search-${index}`, {
          shape: CARD_SHAPES.search[layout],
          catalog: section.catalog,
        })}
      </div>
    </section>
  );
}

/**
 * The browse screens: Discover (addon-driven type -> catalog -> filters),
 * My List (My List | Continue Watching) and Search (phone docked field, web
 * page field, desktop app title-bar field, TV on-screen keyboard; results
 * grouped by type).
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
  profile,
  onProfiles,
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
  /** Phone My List: the current profile and the Who's watching route. */
  profile?: TvProfile;
  onProfiles?: () => void;
}) {
  const tv = !responsive;
  const desktop = responsive && !phone;
  // The web search page carries its own field; the desktop app searches from its title bar.
  const webPage = desktop && !isDesktopShell;
  const layout = phone ? "phone" : "desktop";
  const body = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [searchType, setSearchType] = useState<SearchSectionKey | "all">("all");
  // Desktop: the chip whose popover is open draws as pressed (DeskDiscoverFilter). Focus
  // returns to the chip when the popover closes, which clears it.
  const [expanded, setExpanded] = useState<string>();

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
    void loadCatalog(catalog, nextSkip, catalogValues);
  };

  // The phone and web search fields take the keyboard on arrival.
  useEffect(() => {
    if (screen !== "Search" || !responsive || (desktop && !webPage) || query.trim()) return;
    field.current?.focus({ preventScroll: true });
    // Arrival only: typing must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // ---- Discover data ----------------------------------------------------
  const groups = discoverGroups(catalogs);
  const group: DiscoverGroup | undefined = catalog ? discoverTypeGroup(catalog.type) : groups[0];
  const groupCatalogs = group ? catalogsForGroup(catalogs, group) : [];
  const catalogChoices = catalog ? groupCatalogs : catalogs.filter((c) => c.type !== "live");
  const chipLabels = catalogChipLabels(groupCatalogs);
  const filters = catalog ? catalogFilters(catalog) : [];
  const requiredMissing = filters.some((f) => f.required && !catalogValues[f.name]?.trim());

  const chooseGroup = (next: DiscoverGroup) => {
    const first = catalogsForGroup(catalogs, next)[0];
    if (first && next !== group) void loadCatalog(first);
  };
  const chooseCatalog = (next: Catalog) => {
    if (!sameCatalog(next, catalog)) void loadCatalog(next);
  };
  const cancel: Choice = { label: "Cancel", action: () => setModal(undefined) };
  /** A value list: phone sheet / desktop popover under `invoker` / TV right panel. */
  const openChoices = (title: string, choices: Choice[], invoker?: Element | null, className?: string) => {
    const current = choices.find((choice) => choice.current);
    const anchor = desktop ? anchorUnder(invoker) : undefined;
    setModal({
      title,
      // The desktop popover closes on a press outside or Esc (DeskDiscoverCatalog draws no
      // Cancel row); the phone sheet and the TV panel end with Cancel.
      choices: anchor ? choices : [...choices, cancel],
      focus: current?.label,
      view: { kind: "choices", anchor },
      className,
    });
  };
  const openCatalogs = (invoker?: Element | null) =>
    openChoices(
      "Catalog",
      catalogChoices.map((cat) => ({
        label: catalogChoiceLabel(cat),
        current: sameCatalog(cat, catalog),
        action: () => {
          setModal(undefined);
          chooseCatalog(cat);
        },
      })),
      invoker,
      "vx-browse-popover vx-browse-popover--catalog",
    );
  const openFilter = (target: Catalog, filter: CatalogFilter, invoker?: Element | null) => {
    const current = catalogValues[filter.name]?.trim() ?? "";
    const apply = (value: string) => {
      setModal(undefined);
      void loadCatalog(target, 0, {
        ...catalogValues,
        [filter.name]: value,
      });
    };
    if (filter.options.length)
      openChoices(
        catalogFilterLabel(filter.name),
        [
          ...(!filter.required ? [{ label: "Any", current: !current, action: () => apply("") }] : []),
          ...filter.options.map((value) => ({ label: value, current: value === current, action: () => apply(value) })),
        ],
        invoker,
        "vx-browse-popover",
      );
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

  // ---- My List / Search data ----------------------------------------------
  const listItems = screen === "My List" && libraryQueue ? queue : items;
  const sections = screen === "Search" ? searchSections(searchRows) : [];
  const shownSections = sections.filter((section) => section.items.length > 0);
  const filtered = desktop && searchType !== "all" ? shownSections.filter((section) => section.key === searchType) : [];
  const visibleSections = filtered.length ? filtered : shownSections;
  const typeGrid = filtered.length > 0;
  const searching = busy && !!query.trim();
  const partial = searchPartial ? " Some sources couldn't load." : "";
  const catalogKeyOf = (cat: Catalog) => `${cat.addonId ?? ""}:${cat.type}:${cat.id}`;
  const searchedCatalogs = new Set(searchRows.flatMap((row) => (row.catalog ? [catalogKeyOf(row.catalog)] : [])));
  const pendingAddons = new Set(
    catalogs
      .filter((cat) => cat.supportsSearch && !searchedCatalogs.has(catalogKeyOf(cat)))
      .map((cat) => String(cat.addonId ?? cat.addonName ?? cat.id)),
  ).size;
  const searchingLabel = pendingAddons
    ? `Searching ${pendingAddons} more ${pendingAddons === 1 ? "addon" : "addons"}…`
    : "Searching…";

  const gridShape: CardShape =
    screen === "Discover"
      ? CARD_SHAPES.discover[layout]
      : libraryQueue
        ? CARD_SHAPES.continueWatching
        : CARD_SHAPES.myList;
  const gridKind = tv ? "tv" : gridShape === "poster" ? "poster" : "still";

  // ---- TV search keyboard -------------------------------------------------
  const keyboardKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const id = target.dataset.focusId ?? "";
    const index = KEYS.indexOf(id.replace("key-", ""));
    const back = BACK_KEYS.includes(event.key) || BACK_CODES.includes(event.keyCode);
    if (back && query) {
      // BACK deletes while there is text (legend "BACK Delete"); an empty field goes back.
      event.preventDefault();
      event.stopPropagation();
      setQuery((q) => q.slice(0, -1));
      return;
    }
    if (
      items.length &&
      (["MediaPlay", "MediaPlayPause", "MediaFastForward"].includes(event.key) ||
        [415, 10252, 417].includes(event.keyCode) ||
        (event.key === "ArrowRight" && ((index >= 0 && index % KEY_COLUMNS === KEY_COLUMNS - 1) || id === "clear")))
    ) {
      event.preventDefault();
      event.stopPropagation();
      focusElement("result-0");
    }
  };

  // ---- Pieces ------------------------------------------------------------------
  const discoverControls = () => {
    if (!groups.length) return null;
    const typeItems = groups.map((option) => (
      <TvButton
        key={option}
        id={`discover-type-${option}`}
        className={tv ? "vx-chip" : "vx-segmented__item"}
        aria-pressed={option === group}
        onActivate={() => chooseGroup(option)}
      >
        {discoverGroupLabel(option)}
      </TvButton>
    ));
    const filterChips = catalog
      ? filters.map((filter) => {
          const value = catalogValues[filter.name]?.trim() ?? "";
          return (
            <TvButton
              key={filter.name}
              id={`discover-filter-${filter.name}`}
              className={`vx-chip vx-chip--dropdown${value || expanded === filter.name ? " vx-chip--set" : ""}`}
              aria-haspopup={filter.options.length ? "menu" : "dialog"}
              aria-expanded={desktop && filter.options.length ? expanded === filter.name : undefined}
              aria-label={catalogFilterSummary(filter, value)}
              onFocus={() => setExpanded(undefined)}
              onActivate={(event?: { currentTarget?: Element }) => {
                if (desktop && filter.options.length) setExpanded(filter.name);
                openFilter(catalog, filter, event?.currentTarget ?? document.activeElement);
              }}
            >
              <FilterChipContent filter={filter} value={value} />
            </TvButton>
          );
        })
      : [];
    if (tv)
      return (
        <div className="vx-browse__tv-controls">
          <div className="vx-browse__types" role="group" aria-label="Content type">{typeItems}</div>
          <div className="vx-browse__chips">
          <div className="vx-browse__chip-group" role="group" aria-label="Catalog">
            {groupCatalogs.map((cat, index) => (
              <TvButton
                key={`${cat.addonId ?? ""}:${cat.type}:${cat.id}`}
                id={`discover-catalog-${index}`}
                className="vx-chip"
                aria-pressed={sameCatalog(cat, catalog)}
                onActivate={() => chooseCatalog(cat)}
              >
                {chipLabels[index]}
              </TvButton>
            ))}
          </div>
          {filterChips.length > 0 && <ChipDivider />}
          {filterChips.length > 0 && <div className="vx-browse__chip-group" role="group" aria-label="Filters">{filterChips}</div>}
          </div>
        </div>
      );
    if (phone)
      return (
        <>
          <div className="vx-segmented vx-browse__segmented" role="group" aria-label="Content type">{typeItems}</div>
          <div className="vx-browse__chips" role="group" aria-label="Catalog and filters">
            <button
              type="button"
              className="vx-btn vx-btn--outline vx-btn--icon vx-browse__catalogs"
              aria-label="Choose catalog"
              aria-haspopup="menu"
              onClick={(event) => openCatalogs(event.currentTarget)}
            >
              <SlidersHorizontal aria-hidden="true" strokeWidth={2.2} />
            </button>
            {groupCatalogs.map((cat, index) => (
              <TvButton
                key={`${cat.addonId ?? ""}:${cat.type}:${cat.id}`}
                id={`discover-catalog-${index}`}
                className="vx-chip"
                aria-pressed={sameCatalog(cat, catalog)}
                onActivate={() => chooseCatalog(cat)}
              >
                {chipLabels[index]}
              </TvButton>
            ))}
            {filterChips.length > 0 && <ChipDivider />}
            {filterChips}
          </div>
        </>
      );
    // Desktop app and web: type segments | one catalog control | the catalog's extras.
    return (
      <div className="vx-browse__controls">
        <div className="vx-segmented" role="group" aria-label="Content type">{typeItems}</div>
        <ChipDivider />
        <TvButton
          id="discover-catalog"
          className="vx-chip vx-chip--dropdown vx-chip--set"
          aria-haspopup="menu"
          aria-expanded={expanded === "catalog"}
          aria-label={`Catalog: ${catalog ? catalogChoiceLabel(catalog) : "Choose"}`}
          onFocus={() => setExpanded(undefined)}
          onActivate={(event?: { currentTarget?: Element }) => {
            setExpanded("catalog");
            openCatalogs(event?.currentTarget ?? document.activeElement);
          }}
        >
          <span>{catalog ? catalogChoiceLabel(catalog) : "Catalog"}</span>
          <ChevronDown aria-hidden="true" strokeWidth={2.2} />
        </TvButton>
        {filterChips.length > 0 && <ChipDivider />}
        {filterChips.length > 0 && <div className="vx-browse__chip-group" role="group" aria-label="Filters">{filterChips}</div>}
      </div>
    );
  };

  const libraryControls = () => {
    const segments = [
      { id: "library-list", label: "My List", pressed: !libraryQueue, queue: false },
      { id: "library-queue", label: "Continue Watching", pressed: libraryQueue, queue: true },
    ].map((segment) => (
      <TvButton
        key={segment.id}
        id={segment.id}
        className={tv ? "vx-chip" : "vx-segmented__item"}
        aria-pressed={segment.pressed}
        onActivate={() => setLibraryQueue(segment.queue)}
      >
        {segment.label}
      </TvButton>
    ));
    return tv ? (
      <div className="vx-browse__chips" role="group" aria-label="My List">{segments}</div>
    ) : (
      <div className={`vx-segmented${phone ? " vx-browse__segmented" : ""}`} role="group" aria-label="My List">{segments}</div>
    );
  };

  const browseDiscoverAction = (
    <TvButton id="browse-empty-discover" className="vx-btn vx-btn--light vx-btn--pill vx-btn--lead" onActivate={() => void navigate("Discover")}>
      <Compass aria-hidden="true" strokeWidth={2} />
      Browse Discover
    </TvButton>
  );

  const emptyState = () => {
    if (busy || listItems.length) return null;
    if (screen === "Discover") {
      if (catalogError || !catalog) return null;
      if (requiredMissing)
        return <BrowseEmpty icon={<SlidersHorizontal strokeWidth={2} />}>Choose the required filters to browse this catalog.</BrowseEmpty>;
      return <BrowseEmpty icon={<Compass strokeWidth={2} />} title="No titles yet" />;
    }
    if (screen === "My List")
      return libraryQueue ? (
        <BrowseEmpty icon={<Bookmark strokeWidth={2} />} title="Nothing in progress.">Titles you start watching appear here.</BrowseEmpty>
      ) : (
        <BrowseEmpty icon={<Bookmark strokeWidth={2} />} title="Your list is empty." action={browseDiscoverAction}>
          Add titles with the{" "}
          <span className="vx-browse__inline-plus" role="img" aria-label="plus"><Plus aria-hidden="true" strokeWidth={2.4} /></span>{" "}
          button.
        </BrowseEmpty>
      );
    return null;
  };

  const discoverBody = () => (
    <>
      {catalogError && (
        <BrowseEmpty
          icon={<CircleAlert strokeWidth={2} />}
          alert
          action={
            <TvButton id="catalog-retry" className="vx-btn vx-btn--light vx-btn--pill" onActivate={() => void navigate("Discover")}>
              Retry catalogs
            </TvButton>
          }
        >
          {catalogError}
        </BrowseEmpty>
      )}
      {!busy && !catalogError && !catalogs.length && (
        <BrowseEmpty icon={<Compass strokeWidth={2} />} title="No catalogs are available.">
          Add or enable a catalog addon in Settings.
        </BrowseEmpty>
      )}
    </>
  );

  const grid = () => {
    if (screen === "Discover" && responsive && busy && !listItems.length)
      return (
        <div className={`vx-browse__grid vx-browse__grid--${gridKind} vx-browse__skeleton`} aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <SkeletonTile key={index} kind={gridShape === "poster" ? "poster" : "still"} />)}
        </div>
      );
    if (!listItems.length) return null;
    return (
      <div className={`vx-browse__grid vx-browse__grid--${gridKind}`}>
        {cards(listItems, "result", {
          shape: gridShape,
          catalog: screen === "Discover" ? catalog : undefined,
          // TV browse grids are 360 × 202 tiles (TvDiscover / TvLibrary); Continue Watching is a
          // grid of stills with progress (PhLibraryCW 16:9 fluid, DeskLibraryCW 256 × 128).
          kind: tv ? "grid" : screen === "My List" && libraryQueue ? "still" : undefined,
        })}
      </div>
    );
  };

  const legend: LegendItem[] = screen === "Search"
    ? [{ key: "OK", label: "Type" }, { key: "▶▶", label: "Jump to results" }, { key: "BACK", label: "Delete" }]
    : [{ key: "OK", label: "Select" }, { key: "☰", label: "Options" }];

  // ---- Search ------------------------------------------------------------------
  if (screen === "Search") {
    const noResults = !busy && !!query.trim() && !shownSections.length;
    const blank = !query.trim();
    const statusSpinner = searching && !shownSections.length;
    const statusText = statusSpinner
      ? "Searching…"
      : blank
        ? `Find your next favorite.${partial}`
        : `${items.length} ${items.length === 1 ? "result" : "results"}${searchPartial ? "." : ""}${partial}`;
    const showStatus = noResults
      ? false
      : tv
        ? statusSpinner || searchPartial || blank
        : phone
          ? !blank
          : !blank && (statusSpinner || (searchPartial && !searching));
    const status = showStatus ? (
      <p className="vx-status vx-browse__search-status" role="status">
        {statusSpinner && <span className="vx-spinner" aria-hidden="true" />}
        {statusText}
      </p>
    ) : null;
    const results = (
      <>
        {visibleSections.map((section) => (
          <SearchSectionView
            key={section.key}
            section={section}
            index={shownSections.indexOf(section)}
            layout={layout}
            responsive={responsive}
            phone={phone}
            grid={typeGrid}
            onSeeAll={desktop && shownSections.length > 1 ? () => setSearchType(section.key) : undefined}
            cards={cards}
          />
        ))}
        {noResults && (
          <BrowseEmpty icon={<SearchIcon strokeWidth={2} />} title="No matching titles" center={phone}>
            {partial.trim() || undefined}
          </BrowseEmpty>
        )}
        {blank && responsive && (
          <BrowseEmpty icon={<SearchIcon strokeWidth={2} />} center={phone} className="vx-browse__blank">
            {`Find your next favorite.${partial}`}
          </BrowseEmpty>
        )}
      </>
    );
    if (tv)
      return (
        <main className="vx-browse vx-browse--search">
          <section className="vx-browse__keyboard-panel">
            <h1 className="vx-browse__title">Search</h1>
            <label className="vx-search vx-browse__tv-field">
              <input
                className="vx-sr-only"
                tabIndex={-1}
                maxLength={256}
                aria-label="Search titles"
                placeholder="Search movies and series"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (["Enter", "ArrowRight", "MediaPlay"].includes(e.key) && items.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    focusElement("result-0");
                  }
                }}
              />
              <FieldValue value={query} placeholder="Search movies and series" caret />
            </label>
            <div
              className="vx-keyboard__keys vx-browse__keys"
              onFocusCapture={(event) => {
                const id = (event.target as HTMLElement).dataset.focusId;
                if (id?.startsWith("key-")) searchKey.current = id;
              }}
              onKeyDown={keyboardKeys}
            >
              {KEYS.split("").map((c) => (
                <TvButton
                  id={`key-${c}`}
                  key={c}
                  className="vx-key"
                  onActivate={() => setQuery((q) => (q + c.toLowerCase()).slice(0, 256))}
                >
                  {c.toLowerCase()}
                </TvButton>
              ))}
              <TvButton id="space" className="vx-key vx-key--span-2" aria-label="Space" onActivate={() => setQuery((q) => (q + " ").slice(0, 256))}>
                <Space aria-hidden="true" strokeWidth={2} />
              </TvButton>
              <TvButton id="delete" className="vx-key vx-key--span-2" aria-label="Delete" onActivate={() => setQuery((q) => q.slice(0, -1))}>
                <Delete aria-hidden="true" strokeWidth={2} />
              </TvButton>
              <TvButton id="clear" className="vx-key vx-key--span-2" aria-label="Clear" onActivate={() => setQuery("")}>
                <Trash2 aria-hidden="true" strokeWidth={2} />
              </TvButton>
            </div>
          </section>
          <div className="vx-browse__body vx-browse__results" ref={body}>
            {status}
            {results}
          </div>
          <KeyLegend items={legend} corner />
        </main>
      );
    return (
      <main className={`vx-browse vx-browse--search${blank || noResults ? " is-empty" : ""}`}>
        <div className="vx-browse__head">
          {webPage ? (
            <h1 className="vx-sr-only">Search</h1>
          ) : (
            <div className="vx-browse__heading">
              <h1 className="vx-browse__title">Search</h1>
            </div>
          )}
          {webPage && (
            <label className="vx-search vx-search--page vx-browse__page-field">
              <SearchIcon aria-hidden="true" strokeWidth={2} />
              <input
                ref={field}
                className="vx-search__input"
                type="search"
                maxLength={256}
                aria-label="Search titles"
                placeholder="Search movies and series"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && items.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    focusElement("result-0");
                  }
                }}
              />
              {query && (
                <button type="button" className="vx-search__clear" aria-label="Clear search" onClick={() => { setQuery(""); field.current?.focus(); }}>
                  <X aria-hidden="true" strokeWidth={2.4} />
                </button>
              )}
              <kbd className="vx-kbd" aria-hidden="true">Esc</kbd>
            </label>
          )}
          {desktop && sections.length > 0 && (
            <div className="vx-segmented vx-segmented--drawer vx-browse__types" role="group" aria-label="Result type">
              <button type="button" className="vx-segmented__item" aria-pressed={!typeGrid} onClick={() => setSearchType("all")}>
                All
              </button>
              {sections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className="vx-segmented__item"
                  aria-pressed={typeGrid && searchType === section.key}
                  onClick={() => setSearchType(section.key)}
                >
                  {section.title} · {section.items.length}
                </button>
              ))}
            </div>
          )}
          {status}
        </div>
        <div className="vx-browse__body">{results}</div>
        {desktop && searching && shownSections.length > 0 && (
          <div className="vx-toast vx-browse__progress" role="status">
            <span className="vx-spinner" aria-hidden="true" />
            <span className="vx-toast__text">{searchingLabel}</span>
          </div>
        )}
        {phone && (
          <div className="vx-browse__dock">
            <label className="vx-search vx-browse__dock-field">
              <SearchIcon aria-hidden="true" strokeWidth={2} />
              <input
                ref={field}
                className="vx-search__input"
                type="search"
                maxLength={256}
                aria-label="Search titles"
                placeholder="Search movies and series"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
              {query && (
                <button type="button" className="vx-search__clear" aria-label="Clear search" onClick={() => { setQuery(""); field.current?.focus(); }}>
                  <X aria-hidden="true" strokeWidth={2.4} />
                </button>
              )}
            </label>
          </div>
        )}
      </main>
    );
  }

  // ---- Discover and My List ------------------------------------------------------
  const kind = screen === "Discover" ? "discover" : "library";
  return (
    <main className={`vx-browse vx-browse--${kind}`}>
      <div className="vx-browse__head">
        <div className="vx-browse__heading">
          <h1 className="vx-browse__title">{screen}</h1>
          {/* Phone: Settings is not in the bottom nav; the My List header carries it (Library). */}
          {phone && screen === "My List" && (
            <TvButton id="library-settings" className="vx-btn vx-btn--icon vx-browse__header-action" aria-label="Settings" onActivate={() => void navigate("Settings")}>
              <SettingsIcon aria-hidden="true" strokeWidth={2} />
            </TvButton>
          )}
        </div>
        {phone && screen === "My List" && !libraryQueue && profile && onProfiles && (
          <ProfileSwitch profile={profile} onProfiles={onProfiles} />
        )}
        {screen === "Discover" ? discoverControls() : libraryControls()}
      </div>
      <div className="vx-browse__body" ref={body}>
        {screen === "Discover" && discoverBody()}
        {grid()}
        {/* Reaching the end of a paged catalog loads its next page; there is
            no Load more control on any layout. */}
        {screen === "Discover" && catalog && nextSkip !== undefined && (
          <AutoLoad
            onLoad={loadNextPage}
            disabled={busy}
            generation={items.length}
          />
        )}
        {screen === "Discover" && busy && items.length > 0 && <LoadingMore />}
        {emptyState()}
      </div>
      {tv && <KeyLegend items={legend} corner />}
    </main>
  );
}
