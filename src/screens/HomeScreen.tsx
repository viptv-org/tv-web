import { Fragment, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, Plus } from "lucide-react";
import { HeroArtwork, ReadyImage, artworkUrl } from "../ui/RokuArtwork";
import { ResponsiveTitle } from "../ui/ResponsiveTitle";
import { TvButton } from "../ui/remote";
import type { Catalog, MediaItem, MediaPresentation, TvProfile } from "../api";
import type { Screen } from "../ui/screens";
import { catalogShelfName } from "../ui/catalogFilters";
import { CARD_SHAPES, homeCatalogShape } from "../ui/cardShapes";
import type { CardRowOptions } from "../components/cards/Cards";
import { Shelf } from "../components/cards/ShelfCarousel";
import { formatClock, formatMinutes, formatRuntime } from "../components/cards/cardText";
import type { HomeRow } from "../ui/app/homeRows";
import type { HeroRotation } from "../ui/app/useHero";
import { AutoLoad } from "../ui/AutoLoad";
import { usePhoneLayout } from "../ui/usePhoneLayout";
import { avatarUrl } from "../ui/ProfileEditor";
import { presentation } from "../core/presentations";
import { buttonClass } from "../ui/primitives/Button";
import { CarouselDots, Eyebrow } from "../ui/primitives/Badges";
import { PlayIcon } from "../ui/primitives/icons";
import { ProgressBar } from "../ui/primitives/Progress";
import { SkeletonShelfCards } from "./HomeSkeleton";

/** Seconds each featured title stays in the responsive hero before the next one. */
const HERO_ROTATE_MS = 9000;

type HeroActions = {
  discoverSources: (item: MediaItem, resume?: boolean) => unknown;
  detail: (item: MediaItem) => unknown;
  toggle: (item: MediaItem) => unknown;
};

/**
 * The Home screen (reference Main / DeskHome / WebHome / WideHome / TvHome):
 * the hero plus every shelf (queue, recent live, first catalog, each addon
 * row, My List). All data and actions stay owned by the App state machine;
 * this component only renders what it is given.
 *
 * Phone: wordmark + avatar header, the featured card (FEATURED badge, logo,
 * meta, 2-line synopsis, Play + round +) and its carousel dots. Desktop / web:
 * eyebrow "Featured movie 1 of 5", logo, meta, synopsis, Play / Details / +,
 * sharp art (≤ 776) over a blurred ambient fill; ultra-wide adds the
 * featured list. TV: the focused title's backdrop and hero (eyebrow, logo,
 * S·E + progress + time, meta, synopsis, Resume / Details / +) and the key
 * legend.
 *
 * DOM contract kept for behaviour and tests: `main.home` (+ `compact-home`
 * while a lower TV shelf holds focus), `.shelves > section`, focus ids
 * hero-play / hero-details / hero-save and the card rows' `<prefix>-<i>`.
 */
export function HomeScreen({
  responsive,
  compactHome,
  setCompactHome,
  heroPresentation,
  heroItem,
  heroDetails,
  heroRotation,
  highlighted,
  queue,
  recentLive,
  items,
  homeRows,
  onRowsNeeded,
  favorites,
  firstHomeCatalog,
  navigate,
  openLibrary,
  profile,
  onProfiles,
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
  /** heroItem enriched with its fetched metadata (logo, runtime, synopsis), when it has arrived. */
  heroDetails?: MediaItem;
  heroRotation?: HeroRotation;
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
  /** My List ("See all" under My List) or its Continue Watching segment (queue = true). */
  openLibrary?: (queue: boolean) => void;
  /** The active profile (phone header avatar). */
  profile?: TvProfile;
  onProfiles?: () => void;
  discoverSources: (item: MediaItem, resume?: boolean) => unknown;
  detail: (item: MediaItem) => unknown;
  manage: (item: MediaItem) => void;
  toggle: (item: MediaItem) => unknown;
  shelfCards: (list: readonly MediaItem[], prefix: string, options?: CardRowOptions) => ReactNode;
}) {
  const phone = usePhoneLayout(responsive);
  // Catalog shelves alternate their card shape by position (the first
  // catalog shelf is index 0); queue, live and My List shelves keep theirs.
  const catalogOffset = items.length > 0 ? 1 : 0;
  const details = heroDetails ?? heroItem;
  const saved = !!heroItem && favorites.some((item) => item.id === heroItem.id);
  const actions: HeroActions = { discoverSources, detail, toggle };
  const library = (queueSegment: boolean) => {
    if (openLibrary) openLibrary(queueSegment);
    else void navigate("My List");
  };
  return (
    <main className={`home vx-home ${compactHome ? "compact-home" : ""}`}>
      {!responsive && heroPresentation?.heroImage && (
        <HeroArtwork
          key={heroPresentation.heroImage}
          uri={heroPresentation.heroImage}
        />
      )}
      {phone && (
        <header className="vx-home__header">
          <span className="vx-home__wordmark">VIPTV</span>
          {profile && (
            <button type="button" className="vx-home__avatar" aria-label={`Profile: ${profile.name}`} onClick={onProfiles}>
              <span aria-hidden="true">{profile.name.trim().slice(0, 1).toUpperCase()}</span>
              <ReadyImage src={avatarUrl(profile)} alt="" />
            </button>
          )}
        </header>
      )}
      {/* Without a catalog title there is no responsive hero: no placeholder with dead actions. */}
      {responsive && heroItem && details && (
        <ResponsiveHero
          phone={phone}
          item={heroItem}
          details={details}
          presentation={heroPresentation}
          rotation={heroRotation}
          saved={saved}
          actions={actions}
        />
      )}
      {!responsive && (
        <TvHero
          item={heroItem}
          details={details}
          presentation={heroPresentation}
          highlighted={highlighted}
          queue={queue}
          recentLive={recentLive}
          items={items}
          saved={saved}
          setCompactHome={setCompactHome}
          actions={actions}
          manage={manage}
        />
      )}
      <div
        className="shelves vx-home__shelves"
        onFocusCapture={(event) => {
          const section = (event.target as HTMLElement).closest(
            "section",
          );
          const first = event.currentTarget.querySelector("section");
          setCompactHome(!!section && section !== first);
        }}
      >
        {queue.length > 0 && (
          <Shelf
            title="Continue watching"
            count={responsive && !phone ? queue.length : undefined}
            link="See all"
            linkLabel="See all Continue Watching"
            onLink={() => library(true)}
            controls={responsive}
          >
            {shelfCards(queue, "queue", { shape: CARD_SHAPES.continueWatching, kind: "continue" })}
          </Shelf>
        )}
        {recentLive.length > 0 && (
          <Shelf
            title={phone ? "Live now" : "Recently watched live TV"}
            link="Guide"
            onLink={() => void navigate("Live TV")}
            controls={responsive}
          >
            {shelfCards(recentLive, "recent-live", { shape: CARD_SHAPES.recentLive, kind: "live" })}
          </Shelf>
        )}
        {items.length > 0 && (
          <Shelf
            title={firstHomeCatalog ? (responsive ? catalogShelfName(firstHomeCatalog) : firstHomeCatalog.name) : "Discover"}
            link={firstHomeCatalog ? "See all" : undefined}
            linkLabel={firstHomeCatalog ? `See all ${catalogShelfName(firstHomeCatalog)}` : undefined}
            onLink={() => void navigate("Discover", firstHomeCatalog)}
            controls={responsive}
          >
            {shelfCards(items, "home", { shape: homeCatalogShape(0), catalog: firstHomeCatalog })}
          </Shelf>
        )}
        {homeRows.map((row, i) => {
          // A loaded catalog with nothing to show leaves no shelf. The TV
          // loads every shelf itself and shows each once it has cards.
          if (row.loaded ? !row.items.length : !responsive) return null;
          const shape = homeCatalogShape(catalogOffset + i);
          return (
            <Shelf
              key={`${row.name}-${i}`}
              title={row.name}
              link="See all"
              linkLabel={`See all ${row.name}`}
              onLink={() => void navigate("Discover", row.catalog)}
              controls={responsive}
            >
              {row.loaded ? (
                shelfCards(row.items, `shelf-${i}`, { shape, catalog: row.catalog })
              ) : (
                <>
                  <AutoLoad onLoad={() => onRowsNeeded([row])} generation={0} margin={900} />
                  <SkeletonShelfCards shape={shape} />
                </>
              )}
            </Shelf>
          );
        })}
        {favorites.length > 0 && (
          <Shelf
            title="My List"
            link="See all"
            linkLabel="See all My List"
            onLink={() => library(false)}
            controls={responsive}
          >
            {shelfCards(favorites, "saved", { shape: CARD_SHAPES.myList })}
          </Shelf>
        )}
      </div>
    </main>
  );
}

/** " · "-separated meta parts, as drawn (each part its own span). */
function Meta({ parts, className }: { parts: readonly (string | number | undefined | null | false)[]; className: string }) {
  const shown = parts.filter((part): part is string | number => part !== undefined && part !== null && part !== false && part !== "");
  if (!shown.length) return null;
  return (
    <div className={className}>
      {shown.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">·</span>}
          <span>{part}</span>
        </Fragment>
      ))}
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Phone featured card / desktop hero. Rotates through the featured titles
 * every few seconds while nothing inside it is hovered or focused (and not
 * under reduced motion); phones also swipe it.
 */
function ResponsiveHero({ phone, item, details, presentation: hero, rotation, saved, actions }: {
  phone: boolean;
  item: MediaItem;
  details: MediaItem;
  presentation: MediaPresentation | undefined;
  rotation?: HeroRotation;
  saved: boolean;
  actions: HeroActions;
}) {
  const [held, setHeld] = useState(false);
  const count = rotation?.featured.length ?? 0;
  const index = rotation?.index ?? 0;
  const select = useRef(rotation?.select);
  select.current = rotation?.select;
  useEffect(() => {
    if (count < 2 || held || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => select.current?.(index + 1), HERO_ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [count, index, held]);
  const swipe = useRef<number | null>(null);

  const image = hero?.heroImage ?? undefined;
  const typeLabel = item.type === "series" || item.type === "episode" ? "series" : "movie";
  const play = () => {
    if (hero?.primaryAction === "episodes") void actions.detail(item);
    else void actions.discoverSources(item, !!item.position || item.queueStatus === "next");
  };
  const playLabel = hero?.primaryAction === "episodes" ? "Play" : hero?.primaryActionLabel ?? "Play";
  const runtime = formatRuntime(details.runtime);
  const genres = details.genres.slice(0, 2);
  const title = <ResponsiveTitle title={details.name ?? item.name} logo={hero?.titleLogo} />;
  const synopsis = details.description ? <p className="vx-home__synopsis">{details.description}</p> : null;
  const buttons = (
    <div className="vx-home__actions">
      <TvButton id="hero-play" className={buttonClass({ kind: "primary", icon: true, className: "vx-home__play" })} onActivate={play}>
        <PlayIcon />
        {playLabel}
      </TvButton>
      {!phone && (
        <TvButton id="hero-details" className={buttonClass({ className: "vx-home__details" })} onActivate={() => void actions.detail(item)}>
          Details
        </TvButton>
      )}
      <TvButton
        id="hero-save"
        className={buttonClass({ round: true, className: "vx-home__save" })}
        aria-label={saved ? "Remove from My List" : "Add to My List"}
        aria-pressed={saved}
        onActivate={() => void actions.toggle(item)}
      >
        {saved ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
      </TvButton>
    </div>
  );
  const hold = {
    onPointerEnter: () => setHeld(true),
    onPointerLeave: () => setHeld(false),
    onFocus: () => setHeld(true),
    onBlur: () => setHeld(false),
  };

  if (phone) {
    return (
      <div className="vx-home__featured-wrap" {...hold}>
        <article
          className="vx-home__featured"
          onTouchStart={(event) => { swipe.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            const start = swipe.current;
            swipe.current = null;
            const end = event.changedTouches[0]?.clientX;
            if (start === null || end === undefined || count < 2 || Math.abs(end - start) < 48) return;
            select.current?.(index + (end < start ? 1 : -1));
          }}
        >
          <button type="button" className="vx-home__featured-art responsive-hero-art" aria-label={`${details.name} — details`} onClick={() => void actions.detail(item)}>
            {image && <ReadyImage src={image} alt="" />}
            <span className="vx-home__featured-fade" aria-hidden="true" />
            <span className="vx-badge vx-badge--featured vx-home__featured-badge">Featured</span>
          </button>
          <div className="vx-home__featured-body hero">
            {title}
            <Meta className="vx-home__meta" parts={[details.year, runtime, genres.join(", ")]} />
            {synopsis}
            {buttons}
          </div>
        </article>
        {count > 1 && <div className="vx-home__dots"><CarouselDots count={count} index={index} /></div>}
      </div>
    );
  }

  return (
    <section className="vx-home__hero" aria-label="Featured" {...hold}>
      <div className="vx-home__ambient" aria-hidden="true">
        {image && <ReadyImage src={artworkUrl(image, 256, 144)} alt="" />}
      </div>
      <div className="vx-home__hero-grid">
        <div className="vx-home__copy hero">
          <div className="vx-home__eyebrow">
            <Eyebrow>{`Featured ${typeLabel}`}</Eyebrow>
            {count > 1 && <span className="vx-home__position">{index + 1} of {count}</span>}
          </div>
          {title}
          <Meta className="vx-home__meta" parts={[details.year, runtime, genres.join(" · ")]} />
          {synopsis}
          {buttons}
        </div>
        <div className="vx-home__art responsive-hero-art" onClick={() => void actions.detail(item)}>
          {image && <ReadyImage src={image} alt="" />}
          {count > 1 && <CarouselDots count={count} index={index} overArt />}
        </div>
        {count > 1 && rotation && (
          <div className="vx-home__featured-list" role="group" aria-label="Featured titles">
            <span className="vx-home__featured-list-label">Featured</span>
            {rotation.featured.map((featured, position) => (
              <button
                type="button"
                key={`${featured.type}-${featured.id}`}
                className="vx-home__featured-item"
                aria-current={position === index ? "true" : undefined}
                onClick={() => rotation.select(position)}
              >
                <FeaturedPoster item={featured} />
                <span className="vx-home__featured-text">
                  <span className="vx-home__featured-name">{featured.name}</span>
                  <span className="vx-home__featured-meta">
                    {position === index ? "Now showing" : [featured.year, featured.genres[0]].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturedPoster({ item }: { item: MediaItem }) {
  const poster = presentation(item).posterImage ?? undefined;
  return (
    <span className="vx-home__featured-poster" aria-hidden="true">
      {poster && <ReadyImage src={artworkUrl(poster, 300, 450)} alt="" loading="lazy" decoding="async" />}
    </span>
  );
}

/**
 * TV hero: the focused (or first) title. Resume / Play keeps the Roku action
 * meaning: OK plays (resuming when there is a position), a held OK on a
 * queued title opens its title menu.
 */
function TvHero({ item, details, presentation: hero, highlighted, queue, recentLive, items, saved, setCompactHome, actions, manage }: {
  item: MediaItem | undefined;
  details: MediaItem | undefined;
  presentation: MediaPresentation | undefined;
  highlighted: MediaItem | undefined;
  queue: readonly MediaItem[];
  recentLive: readonly MediaItem[];
  items: readonly MediaItem[];
  saved: boolean;
  setCompactHome: Dispatch<SetStateAction<boolean>>;
  actions: HeroActions;
  manage: (item: MediaItem) => void;
}) {
  const target = highlighted ?? queue[0] ?? recentLive[0] ?? items[0];
  const eyebrow = target?.type === "live"
    ? "Live now"
    : (highlighted ?? queue[0])?.position
      ? "Continue watching"
      : `Featured ${target?.type ?? "movie"}`;
  const position = item?.position ?? 0;
  const duration = item?.duration ?? 0;
  const progress = hero && position > 0 ? hero.progress : 0;
  const episodeLabel = hero?.episodeLabel ?? "";
  const progressLine = !!episodeLabel || progress > 0;
  const genres = details?.genres.slice(0, 3).join(" · ");
  return (
    <div className="vx-home__tv-hero hero">
      <span className="vx-home__tv-eyebrow">{eyebrow}</span>
      <ResponsiveTitle title={details?.name ?? item?.name ?? "VIPTV"} logo={hero?.titleLogo} />
      {progressLine && (
        <div className="vx-home__tv-progress">
          {episodeLabel && <span className="vx-home__tv-episode">{episodeLabel}</span>}
          {progress > 0 && <ProgressBar value={progress * 100} className="vx-home__tv-bar" />}
          {progress > 0 && duration > 0 && (
            <span className="vx-home__tv-time">{`${formatClock(position)} of ${formatMinutes(duration / 60)}`}</span>
          )}
        </div>
      )}
      <Meta
        className="vx-home__meta"
        parts={[
          details?.year,
          !progressLine && formatRuntime(details?.runtime),
          details?.imdbRating ? `IMDb ${details.imdbRating}` : undefined,
          genres,
        ]}
      />
      {details?.description && <p className="vx-home__synopsis">{details.description}</p>}
      <div className="vx-home__actions">
        <TvButton
          id="hero-play"
          className={buttonClass({ icon: true, className: `vx-home__play ${target?.queueStatus === "next" ? "wide-action" : ""}` })}
          onFocus={() => setCompactHome(false)}
          onActivate={() => {
            if (target)
              void actions.discoverSources(
                target,
                !!target.position || target.queueStatus === "next",
              );
          }}
          onHold={() => {
            if (!target) return;
            if (
              target.type !== "live" &&
              queue.some(
                (queued) =>
                  queued.id === target.id &&
                  queued.type === target.type,
              )
            )
              manage(target);
            else void actions.discoverSources(target);
          }}
        >
          <PlayIcon />
          {hero?.primaryActionLabel ?? "Play"}
        </TvButton>
        <TvButton
          id="hero-details"
          className={buttonClass({ className: "vx-home__details" })}
          onFocus={() => setCompactHome(false)}
          onActivate={() => {
            if (target) void actions.detail(target);
          }}
        >
          Details
        </TvButton>
        {target && target.type !== "live" && (
          <TvButton
            id="hero-save"
            className={buttonClass({ round: true, className: "vx-home__save" })}
            aria-label={saved ? "Remove from My List" : "Add to My List"}
            aria-pressed={saved}
            onFocus={() => setCompactHome(false)}
            onActivate={() => void actions.toggle(target)}
          >
            {saved ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
          </TvButton>
        )}
      </div>
    </div>
  );
}
