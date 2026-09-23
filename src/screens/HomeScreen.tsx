import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, ChevronRight, Plus } from "lucide-react";
import { CardArtwork, HeroArtwork } from "../ui/RokuArtwork";
import { ResponsiveTitle } from "../ui/ResponsiveTitle";
import { RokuText } from "../ui/RokuText";
import { TvButton } from "../ui/remote";
import type { Catalog, MediaItem, MediaPresentation } from "../api";
import type { Screen } from "../ui/screens";
import { catalogShelfName } from "../ui/catalogFilters";
import { CARD_SHAPES, homeCatalogShape } from "../ui/cardShapes";
import type { CardRowOptions } from "../components/cards/Cards";
import type { HomeRow } from "../ui/app/homeRows";
import { AutoLoad } from "../ui/AutoLoad";
import { SkeletonShelfCards } from "./HomeSkeleton";


/**
 * The Home screen: hero presentation plus every shelf (queue, recent live,
 * first catalog, each addon row, favorites). All data and actions stay owned
 * by the App state machine; this component only renders what it is given,
 * with the DOM contract (class names, focus ids, roles) frozen.
 */
export function HomeScreen({
  responsive,
  compactHome,
  setCompactHome,
  heroPresentation,
  heroItem,
  highlighted,
  queue,
  recentLive,
  items,
  homeRows,
  onRowsNeeded,
  favorites,
  firstHomeCatalog,
  navigate,
  discoverSources,
  detail,
  manage,
  toggle,
  shelfCards,
}: {
  responsive: boolean;
  compactHome: boolean;
  setCompactHome: Dispatch<SetStateAction<boolean>>;
  heroPresentation: MediaPresentation | undefined;
  heroItem: MediaItem | undefined;
  highlighted: MediaItem | undefined;
  queue: readonly MediaItem[];
  recentLive: readonly MediaItem[];
  items: readonly MediaItem[];
  homeRows: readonly HomeRow[];
  /** Asks for pending shelves' catalogs as they near the viewport. */
  onRowsNeeded: (rows: readonly HomeRow[]) => void;
  favorites: readonly MediaItem[];
  firstHomeCatalog: Catalog | undefined;
  navigate: (next: Screen, catalog?: Catalog) => unknown;
  discoverSources: (item: MediaItem, resume?: boolean) => unknown;
  detail: (item: MediaItem) => unknown;
  manage: (item: MediaItem) => void;
  toggle: (item: MediaItem) => unknown;
  shelfCards: (list: readonly MediaItem[], prefix: string, options?: CardRowOptions) => ReactNode;
}) {
  // Catalog shelves alternate their card shape by position (the first
  // catalog shelf is index 0); queue, live and My List shelves keep theirs.
  const catalogOffset = items.length > 0 ? 1 : 0;
  return (
    <main className={`home ${compactHome ? "compact-home" : ""}`}>
      {!responsive && heroPresentation?.heroImage && (
        <HeroArtwork
          key={heroPresentation.heroImage}
          uri={heroPresentation.heroImage}
        />
      )}
      {responsive && heroItem && <div className="responsive-hero-art"><CardArtwork src={heroPresentation?.heroImage ?? undefined} fallback="Preview unavailable" /></div>}
      {/* Without a catalog title there is no hero: no placeholder with dead actions. */}
      {(!responsive || heroItem) && <div className="hero">
        <small>
          {responsive
            ? `FEATURED ${(heroItem?.type ?? "movie").toUpperCase()}`
            : (highlighted ?? queue[0] ?? recentLive[0] ?? items[0])?.type === "live"
              ? "LIVE NOW"
              : (highlighted ?? queue[0])?.position
                ? "CONTINUE WATCHING"
                : `FEATURED ${(highlighted ?? items[0])?.type?.toUpperCase() ?? "MOVIE"}`}
        </small>
        {responsive ? <ResponsiveTitle title={heroItem?.name ?? "VIPTV"} logo={heroPresentation?.titleLogo} /> : <h1><RokuText>{heroItem?.name ?? "VIPTV"}</RokuText></h1>}
        <p>
          {heroItem?.description ?? ""}
        </p>
        <div className="hero-facts">
          {[
            heroItem?.year,
            heroItem?.runtime,
            ...(heroItem?.genres.slice(0, 2) ?? []),
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </div>
        <div className="actions">
          {!responsive && (
            <TvButton
              id="hero-play"
              className={
                (highlighted ?? queue[0])?.queueStatus === "next"
                  ? "wide-action"
                  : undefined
              }
              onFocus={() => setCompactHome(false)}
              onActivate={() => {
                const item = highlighted ?? queue[0] ?? recentLive[0] ?? items[0];
                if (item)
                  void discoverSources(
                    item,
                    !!item.position || item.queueStatus === "next",
                  );
              }}
              onHold={() => {
                const item = highlighted ?? queue[0] ?? recentLive[0] ?? items[0];
                if (!item) return;
                if (
                  item.type !== "live" &&
                  queue.some(
                    (queued) =>
                      queued.id === item.id &&
                      queued.type === item.type,
                  )
                )
                  manage(item);
                else void discoverSources(item);
              }}
            >
              {heroPresentation?.primaryActionLabel ?? "Play"}
            </TvButton>
          )}
          <TvButton
            id="hero-details"
            onFocus={() => setCompactHome(false)}
            onActivate={() => {
              const item = responsive ? heroItem : (highlighted ?? queue[0] ?? recentLive[0] ?? items[0]);
              if (item) void detail(item);
            }}
          >
            Details
          </TvButton>
          {responsive && (
            <TvButton
              id="hero-save"
              className="compact-action hero-save-btn"
              aria-label="My List"
              aria-pressed={favorites.some((item) => item.id === heroItem?.id)}
              onActivate={() => { if (heroItem) void toggle(heroItem); }}
            >
              {favorites.some((item) => item.id === heroItem?.id) ? (
                <Check size={18} />
              ) : (
                <Plus size={18} />
              )}
            </TvButton>
          )}
        </div>
      </div>}
      <div
        className="shelves"
        onFocusCapture={(event) => {
          const section = (event.target as HTMLElement).closest(
            "section",
          );
          const first = event.currentTarget.querySelector("section");
          setCompactHome(!!section && section !== first);
        }}
      >
        {queue.length > 0 && (
          <section>
            <h2>Continue Watching</h2>
            {shelfCards(queue, "queue", { shape: CARD_SHAPES.continueWatching })}
          </section>
        )}
        {recentLive.length > 0 && (
          <section>
            <h2>Recently Watched Live TV</h2>
            {shelfCards(recentLive, "recent-live", { shape: CARD_SHAPES.recentLive })}
          </section>
        )}
        {items.length > 0 && (
          <section>
            <header className="shelf-heading">
              <h2>{firstHomeCatalog ? (responsive ? catalogShelfName(firstHomeCatalog) : firstHomeCatalog.name) : "Discover"}</h2>
              {responsive && firstHomeCatalog && (
                <button
                  type="button"
                  className="shelf-see-more"
                  aria-label="See more"
                  onClick={() => void navigate("Discover", firstHomeCatalog)}
                >
                  more
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              )}
            </header>
            {shelfCards(items, "home", { shape: homeCatalogShape(0), catalog: firstHomeCatalog })}
          </section>
        )}
        {homeRows.map((row, i) => {
          // A loaded catalog with nothing to show leaves no shelf. The TV
          // loads every shelf itself and shows each once it has cards.
          if (row.loaded ? !row.items.length : !responsive) return null;
          const shape = homeCatalogShape(catalogOffset + i);
          return (
            <section key={`${row.name}-${i}`}>
              <header className="shelf-heading">
                <h2>{row.name}</h2>
                {responsive && (
                  <button
                    type="button"
                    className="shelf-see-more"
                    aria-label="See more"
                    onClick={() => void navigate("Discover", row.catalog)}
                  >
                    more
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                )}
              </header>
              {row.loaded ? (
                shelfCards(row.items, `shelf-${i}`, { shape, catalog: row.catalog })
              ) : (
                <>
                  <AutoLoad onLoad={() => onRowsNeeded([row])} generation={0} margin={900} />
                  <SkeletonShelfCards shape={shape} />
                </>
              )}
            </section>
          );
        })}
        {favorites.length > 0 && (
          <section>
            <h2>My List</h2>
            {shelfCards(favorites, "saved", { shape: CARD_SHAPES.myList })}
          </section>
        )}
      </div>
    </main>
  );
}
