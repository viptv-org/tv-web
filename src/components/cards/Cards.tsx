import { memo, useCallback, useLayoutEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { Film, MoreHorizontal } from "lucide-react";
import { cardPresentation } from "../../core/presentations";
import { type CardPresentation, type Catalog, type MediaItem, type MediaSource } from "../../api";
import { TvButton } from "../../ui/remote";
import { TileImage } from "../../ui/RokuArtwork";
import type { Screen } from "../../ui/screens";
import type { CardShape } from "../../ui/cardShapes";
import { usePhoneLayout } from "../../ui/usePhoneLayout";
import { LiveBadge, LiveLabel } from "../../ui/primitives/Badges";
import { MissingArt } from "../../ui/primitives/Cards";
import { PlayIcon } from "../../ui/primitives/icons";
import { cardMeta, channelMonogram, continueMeta, liveSubtitle, phoneContinueMeta } from "./cardText";

export { cardMeta } from "./cardText";

/**
 * Latest card action closures for the memoized card row: the row reads the
 * ref at click time so prop identities stay stable while App re-renders.
 */
export type CardActions = {
  play: (item: MediaItem, source?: MediaSource, position?: number) => unknown;
  discoverSources: (item: MediaItem, resume?: boolean) => unknown;
  detail: (item: MediaItem, origin?: Catalog) => unknown;
  manage: (item: MediaItem) => void;
};

/**
 * Tile kinds (components.md §6; src/styles/primitives/cards.css):
 *   poster    P fluid 4:5 (fills its grid cell; 111 wide in a Home shelf) · D 172 × 258 ·
 *             web 164 × 246 · TV: a still
 *   still     landscape still + caption: D 256 × 128 · TV 320 × 180 · P fluid 16:9 when asked
 *             for explicitly (a shape-derived landscape row draws posters on phones)
 *   continue  a still with progress and the hover play disc (P: the 292 × 96 continue card)
 *   live      text monogram + LIVE: D 220 × 124 · TV still (P: the 200-wide live-now card)
 *   grid      TV grid tile 360 × 202 (browse grids); responsive layouts draw posters
 * Queue cards (Home queue row, My List → Continue Watching) carry progress in the art and the
 * resume caption whatever their kind.
 */
export type CardKind = "poster" | "still" | "continue" | "live" | "grid";

/** Per-row rendering options for the card-row helpers. */
export type CardRowOptions = {
  shape?: CardShape;
  /** The catalog the row lists, handed to the detail page as the title's origin. */
  catalog?: Catalog;
  /** Opt-in horizontal windowing for scroller rows (Home shelves). */
  windowed?: boolean;
  /**
   * Tile kind for the row's non-live cards. Defaults: queue rows "continue",
   * otherwise `shape` (poster → "poster", landscape → "still").
   */
  kind?: CardKind;
};

// Fallback row pitch until the real one is measured: a 256px desktop still
// in a 16px-gap track. The measured pitch and gap drive the window math and
// the spacer widths so the track's total width and every card position stay
// identical to a fully rendered row at every width (tile widths and gaps
// change per platform).
const CARD_WIDTH = 256;
const CARD_GAP = 16;
const CARD_PITCH = CARD_WIDTH + CARD_GAP;
/** Cards kept mounted beyond each viewport edge before they scroll in. */
const WINDOW_BUFFER = 3;
/** Direct children of a responsive track: one slot per card (card + phone ⋯). */
const SLOT = "vx-card-slot";

/**
 * Last measured row geometry per card kind and window width. A remounted
 * row (Back to Home, say) starts from it, so it neither mounts cards for the
 * fallback pitch nor re-renders once it has measured itself.
 */
const measuredMetrics = new Map<string, { pitch: number; gap: number }>();
const metricsKey = (kind: string) =>
  `${kind}:${typeof window === "undefined" ? 0 : window.innerWidth}`;

function windowFor(
  scrollLeft: number,
  clientWidth: number,
  total: number,
  pitch: number,
) {
  const start = Math.max(0, Math.floor(scrollLeft / pitch) - WINDOW_BUFFER);
  const end = Math.min(
    total,
    Math.ceil((scrollLeft + clientWidth) / pitch) + WINDOW_BUFFER,
  );
  return { start, end };
}

/**
 * The kind a card renders as on this platform. `explicit` is true when the
 * row asked for its kind (CardRowOptions.kind) rather than deriving it from
 * the shape.
 */
function resolveKind(item: MediaItem, rowKind: CardKind, responsive: boolean, phone: boolean, explicit: boolean): CardKind {
  if (item.type === "live") return "live";
  // The TV Home is landscape throughout; TV grids ask for "grid" explicitly.
  if (!responsive && rowKind === "poster") return "still";
  // "grid" is the TV grid tile; responsive grids draw posters.
  if (responsive && rowKind === "grid") return "poster";
  // Phones draw shape-derived catalog rows as posters (reference Main /
  // Discover / PhOverflowCue); an explicit "still" stays a fluid 16:9 still
  // (PhLibraryCW).
  if (phone && rowKind === "still" && !explicit) return "poster";
  return rowKind;
}

/** The art size requested from the image pipeline per kind. */
const ART_SIZE: Record<"tv" | "responsive", [number, number]> = { tv: [320, 180], responsive: [256, 144] };

/**
 * One memoized row of media cards for every screen. Unrelated App re-renders
 * (hero swaps, busy toggles, player state) must not re-run per-card WASM
 * normalization for hundreds of cards, so this row re-renders only when its
 * list, prefix, screen or queue context actually changes. Actions come from
 * a ref so fresh closures never break the memo.
 *
 * In the responsive layout the row is horizontally windowed: only the cards
 * inside (or near) the visible slice of the track are mounted, with pixel
 * spacers standing in for the unmounted remainder. The TV layout keeps
 * every card mounted for its spatial navigation engine.
 *
 * DOM contract: the track is `.cards` (TV reveal scrolling, e2e), every
 * focusable card is `.media-card` with its `<prefix>-<index>` focus id; in
 * the responsive layout each card sits in a `.vx-card-slot` beside its
 * phone ⋯ button (touch overflow → the title menu).
 */
export const Cards = memo(function Cards({
  list,
  prefix,
  screen,
  responsive,
  libraryQueue,
  actions,
  searchKey,
  setHighlighted,
  windowed,
  shape = "landscape",
  catalog,
  kind,
}: {
  list: readonly MediaItem[];
  prefix: string;
  screen: Screen;
  responsive: boolean;
  libraryQueue: boolean;
  actions: MutableRefObject<CardActions>;
  searchKey: MutableRefObject<string>;
  setHighlighted: Dispatch<SetStateAction<MediaItem | undefined>>;
  /** Opt-in horizontal windowing for scroller rows (Home shelves). */
  windowed?: boolean;
  shape?: CardShape;
  catalog?: Catalog;
  kind?: CardKind;
}) {
  const track = useRef<HTMLDivElement>(null);
  const phone = usePhoneLayout(responsive);
  const inQueue = prefix === "queue" || (screen === "My List" && libraryQueue);
  const rowKind: CardKind = kind ?? (inQueue ? "continue" : shape === "poster" ? "poster" : "still");
  // A row of live channels stays a live row whatever kind was asked for.
  const liveRow = list.length > 0 && list.every((item) => item.type === "live");
  const explicitKind = kind !== undefined;
  const displayKind = liveRow ? "live" : resolveKind(list.find((item) => item.type !== "live") ?? list[0] ?? ({ type: "movie" } as MediaItem), rowKind, responsive, phone, explicitKind);
  const windowedRow = responsive && windowed === true && !liveRow;
  // Measured per layout: the pitch between consecutive cards and the gap
  // around the spacers. Read during render from the last measurement; every
  // measurement is followed by a re-render, so the spacers never render
  // against stale geometry for more than the pre-measure commit.
  const metrics = useRef(measuredMetrics.get(metricsKey(displayKind)) ?? { pitch: CARD_PITCH, gap: CARD_GAP });
  // The first window covers the viewport, not a 1920px canvas: a phone row
  // mounts the few cards it can show plus the scroll buffer.
  const [range, setRange] = useState(() => ({
    start: 0,
    end: Math.min(
      list.length,
      Math.ceil((typeof window === "undefined" ? 1920 : window.innerWidth) / metrics.current.pitch) + WINDOW_BUFFER,
    ),
  }));

  const read = useCallback(() => {
    const node = track.current;
    if (!node) return;
    const cards = node.querySelectorAll<HTMLElement>(`:scope > .${SLOT}`);
    const first = cards[0];
    const second = cards[1];
    const previousMetrics = metrics.current;
    if (first && second) {
      const measured = second.offsetLeft - first.offsetLeft;
      if (measured > 32)
        metrics.current = {
          pitch: measured,
          gap: Math.max(0, measured - first.offsetWidth),
        };
    } else if (first) {
      const gap = parseFloat(getComputedStyle(node).columnGap) || CARD_GAP;
      metrics.current = { pitch: first.offsetWidth + gap, gap };
    }
    const next = windowFor(
      node.scrollLeft,
      node.clientWidth,
      list.length,
      metrics.current.pitch,
    );
    // A changed pitch re-renders even for an unchanged window, so the
    // spacers never keep the pre-measure fallback geometry.
    const remeasured =
      metrics.current.pitch !== previousMetrics.pitch || metrics.current.gap !== previousMetrics.gap;
    measuredMetrics.set(metricsKey(displayKind), metrics.current);
    setRange((previous) =>
      !remeasured && previous.start === next.start && previous.end === next.end ? previous : next,
    );
  }, [list.length, displayKind]);

  useLayoutEffect(() => {
    if (!windowedRow) return;
    read();
    const node = track.current;
    if (!node) return;
    // The window follows the scroll offset synchronously: no blank spacer
    // region is ever painted and restored offsets settle exactly.
    const onScroll = () => read();
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [read, windowedRow]);

  const visible = windowedRow ? list.slice(range.start, range.end) : list;
  const offset = windowedRow ? range.start : 0;
  const leftSpacer =
    windowedRow && range.start > 0
      ? range.start * metrics.current.pitch - metrics.current.gap
      : 0;
  const rightSpacer =
    windowedRow && range.end < list.length
      ? (list.length - range.end) * metrics.current.pitch - metrics.current.gap
      : 0;

  return (
    <div
      className={`cards vx-cards vx-cards--${displayKind} ${displayKind === "poster" ? "poster-grid" : ""}`}
      data-scroll-id={`cards-${prefix}`}
      ref={track}
    >
      {leftSpacer > 0 && <div className="vx-cards__spacer" aria-hidden="true" style={{ flex: `0 0 ${leftSpacer}px` }} />}
      {visible.map((item, localIndex) => {
        const i = offset + localIndex;
        const context = inQueue ? "queue" : "catalog";
        const presentation = cardPresentation(item, context);
        const current = actions.current;
        const activate = () => {
          switch (presentation.primaryAction) {
            case "play": return current.play(item);
            case "resume": case "next": return current.discoverSources(item, true);
            case "sources": return current.discoverSources(item);
            default: return current.detail(item, catalog);
          }
        };
        const cardKind = resolveKind(item, rowKind, responsive, phone, explicitKind);
        const key = `${item.type}-${item.id}`;
        const card = (
          <TvButton
            className={cardClassFor(cardKind, phone)}
            aria-label={item.name}
            id={`${prefix}-${i}`}
            data-nav-left={
              i > 0
                ? `${prefix}-${i - 1}`
                : screen === "Search"
                  ? searchKey.current
                  : undefined
            }
            data-nav-right={
              i + 1 < list.length ? `${prefix}-${i + 1}` : `${prefix}-${i}`
            }
            key={key}
            onFocus={() => { if (!responsive) setHighlighted(item); }}
            onActivate={() => void activate()}
            onHold={() => {
              // Only the first logical Home row is a queue-management context.
              // Other Home cards retain their ordinary selection on a held OK;
              // My List, search and episode-card menus remain contextual.
              if (screen === "Home") {
                if (inQueue && item.type !== "live") actions.current.manage(item);
                else void activate();
              } else actions.current.manage(item);
            }}
          >
            <CardBody item={item} kind={cardKind} context={context} presentation={presentation} responsive={responsive} phone={phone} />
          </TvButton>
        );
        if (!responsive) return card;
        // Touch overflow (P): a visible ⋯ on posters and continue cards opens the
        // title menu; long-press (the card's context menu) still does the same.
        const overflow = phone && (cardKind === "poster" || cardKind === "continue");
        return (
          <div className={`${SLOT} ${SLOT}--${cardKind}`} key={key}>
            {card}
            {overflow && (
              <button
                type="button"
                className={`vx-card-more vx-card-more--${cardKind}`}
                aria-label={`More for ${presentation.title}`}
                aria-haspopup="dialog"
                onClick={() => actions.current.manage(item)}
              >
                <span className="vx-card-more__disc" aria-hidden="true"><MoreHorizontal /></span>
              </button>
            )}
          </div>
        );
      })}
      {rightSpacer > 0 && <div className="vx-cards__spacer" aria-hidden="true" style={{ flex: `0 0 ${rightSpacer}px` }} />}
    </div>
  );
});

function cardClassFor(kind: CardKind, phone: boolean) {
  if (phone && kind === "continue") return "media-card vx-continue-card";
  if (phone && kind === "live") return "media-card vx-live-card";
  // TV / desktop "still" tiles share the continue geometry (D 256 × 128, TV 320 × 180).
  const tile = kind === "still" ? "continue" : kind;
  return `media-card vx-card vx-card--${tile}${kind === "still" ? " vx-card--still" : ""}`;
}

/** A card's inside for its kind: art (+ badge, progress, hover play) and the caption. */
function CardBody({ item, kind, context, presentation, responsive, phone }: {
  item: MediaItem;
  kind: CardKind;
  context: "queue" | "catalog";
  presentation: CardPresentation;
  responsive: boolean;
  phone: boolean;
}) {
  const progress = presentation.progress != null && presentation.progress > 0 ? presentation.progress * 100 : undefined;
  const size = responsive ? ART_SIZE.responsive : ART_SIZE.tv;
  const title = presentation.title;
  if (kind === "live") {
    const sub = liveSubtitle(item);
    if (phone) {
      return (
        <>
          <LiveLabel>Live</LiveLabel>
          <span className="vx-live-card__title">{title}</span>
          {sub && <span className="vx-live-card__sub">{sub}</span>}
        </>
      );
    }
    return (
      <>
        <span className="vx-card__art vx-card__art--monogram">
          <span className="vx-card__monogram" aria-hidden="true">{channelMonogram(title)}</span>
          <span className="vx-card__badge"><LiveBadge /></span>
        </span>
        <span className="vx-card__caption">
          <span className="vx-card__title">{title}</span>
          {sub && <span className="vx-card__meta">{sub}</span>}
        </span>
      </>
    );
  }
  if (phone && kind === "continue") {
    // The portrait thumb shows a title's poster (Main); an episode keeps its
    // Rust-chosen still (the core never swaps a series poster in for it).
    const episode = (item.episode ?? 0) > 0 || item.type === "episode";
    return (
      <>
        <TileImage item={item} context={context} initial={presentation} poster={!episode} size={size} className="vx-continue-card__thumb" missing={<span className="vx-continue-card__thumb" aria-hidden="true" />} />
        <span className="vx-continue-card__body">
          <span className="vx-continue-card__title">{title}</span>
          <span className="vx-continue-card__meta">{phoneContinueMeta(item)}</span>
          <ProgressTrack value={progress ?? 0} />
        </span>
        <span className="vx-continue-card__play" aria-hidden="true"><PlayIcon /></span>
      </>
    );
  }
  // The hover play disc (D) only where activating the card plays.
  const plays = presentation.primaryAction !== "details" && presentation.primaryAction !== "episodes";
  // Queue cards read "Resume from 73:46" / "S1 E1 · Pilot · 5:43"; catalog
  // cards the year (phone) or year · runtime · genres (desktop / TV).
  const meta = kind === "continue" || context === "queue"
    ? continueMeta(item, presentation)
    : phone ? cardMeta(item) : presentation.subtitle;
  return (
    <>
      <span className="vx-card__art">
        <TileImage
          item={item}
          context={context}
          initial={presentation}
          poster={kind === "poster"}
          size={size}
          missing={<MissingArt title={title} icon={<Film aria-hidden="true" />} />}
        />
        {progress !== undefined && (
          <span className="vx-card__progress"><ProgressTrack value={progress} /></span>
        )}
        {responsive && !phone && plays && kind !== "poster" && (
          <span className="vx-card__play" aria-hidden="true"><span className="vx-card__play-disc"><PlayIcon /></span></span>
        )}
      </span>
      <span className="vx-card__caption">
        <span className="vx-card__title">{title}</span>
        {meta && <span className="vx-card__meta">{meta}</span>}
      </span>
    </>
  );
}

/** Progress bar (0–100): the accent fill on the tile's track. */
function ProgressTrack({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span className="vx-progress" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <span className="vx-progress__fill" style={{ width: `${clamped}%` }} />
    </span>
  );
}
