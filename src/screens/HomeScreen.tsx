import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, ChevronRight, Plus } from "lucide-react";
import { CardArtwork, HeroArtwork } from "../ui/RokuArtwork";
import { ResponsiveTitle } from "../ui/ResponsiveTitle";
import { RokuText } from "../ui/RokuText";
import { TvButton } from "../ui/remote";
import type { Catalog, MediaItem, MediaPresentation } from "../api";
import type { Screen } from "../ui/screens";


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
  homeRows: readonly { name: string; items: readonly MediaItem[]; catalog?: Catalog }[];
  favorites: readonly MediaItem[];
  firstHomeCatalog: Catalog | undefined;
  navigate: (next: Screen, catalog?: Catalog) => unknown;
  discoverSources: (item: MediaItem, resume?: boolean) => unknown;
  detail: (item: MediaItem) => unknown;
  manage: (item: MediaItem) => void;
  toggle: (item: MediaItem) => unknown;
  shelfCards: (list: readonly MediaItem[], prefix: string) => ReactNode;
}) {
  return (
    <main className={`home ${compactHome ? "compact-home" : ""}`}>
      {!responsive && heroPresentation?.heroImage && (
        <HeroArtwork
          key={heroPresentation.heroImage}
          uri={heroPresentation.heroImage}
        />
      )}
      {responsive && <div className="responsive-hero-art"><CardArtwork src={heroPresentation?.heroImage ?? undefined} fallback="Preview unavailable" /></div>}
      <div className="hero">
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
      </div>
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
            {shelfCards(queue, "queue")}
          </section>
        )}
        {recentLive.length > 0 && (
          <section>
            <h2>Recently Watched Live TV</h2>
            {shelfCards(recentLive, "recent-live")}
          </section>
        )}
        {items.length > 0 && (
          <section>
            <header className="shelf-heading">
              <h2>{firstHomeCatalog?.name ?? "Discover"}</h2>
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
            {shelfCards(items, "home")}
          </section>
        )}
        {homeRows
          .filter((row) => row.items.length)
          .map((row, i) => (
            <section key={`${row.name}-${i}`}>
              <header className="shelf-heading">
                <h2>{row.name}</h2>
                {responsive && row.catalog && (
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
              {shelfCards(row.items, `shelf-${i}`)}
            </section>
          ))}
        {favorites.length > 0 && (
          <section>
            <h2>My List</h2>
            {shelfCards(favorites, "saved")}
          </section>
        )}
      </div>
    </main>
  );
}
