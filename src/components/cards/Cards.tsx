import { memo, useCallback, useLayoutEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { cardPresentation } from "../../core/presentations";
import { type CardPresentation, type Catalog, type MediaItem, type MediaSource } from "../../api";
import { RokuText } from "../../ui/RokuText";
import { TvButton } from "../../ui/remote";
import { SharedCardThumbnail, SharedPosterThumbnail } from "../../ui/RokuArtwork";
import type { Screen } from "../../ui/screens";
import type { CardShape } from "../../ui/cardShapes";

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

/** Per-row rendering options for the card-row helpers. */
export type CardRowOptions = {
  shape?: CardShape;
  /** The catalog the row lists, handed to the detail page as the title's origin. */
  catalog?: Catalog;
  /** Opt-in horizontal windowing for scroller rows (Home shelves). */
  windowed?: boolean;
};

// Fallback row pitch until the real one is measured: .responsive-card is
// 256px wide in a 24px-gap flex track. The measured pitch and gap drive the
// window math and the spacer widths so the track's total width and every
// card position stay identical to a fully rendered row under every
// responsive media query — the card width and gap both change across
// breakpoints, and a hardcoded pitch would drift and shift restored offsets.
const CARD_WIDTH = 256;
const CARD_GAP = 24;
const CARD_PITCH = CARD_WIDTH + CARD_GAP;
/** Cards kept mounted beyond each viewport edge before they scroll in. */
const WINDOW_BUFFER = 3;

const QUEUE_STATUS: Readonly<Record<string, string>> = {
  next: "Up next",
  caught_up: "Caught up",
  upcoming: "Coming soon",
  pending: "Find next",
  unavailable: "Find next",
};

/**
 * The minimal context printed under a phone card's title: the episode
 * number (or the year for a title), plus a short queue state. Genres,
 * runtimes and resume times stay out of the card; the progress bar already
 * carries the resume position.
 */
export function cardMeta(item: MediaItem): string {
  if (item.type === "live") return "";
  const episode = item.episode ?? 0;
  const context =
    episode > 0 || item.type === "episode"
      ? `${item.season ? `S${item.season} ` : ""}E${episode || 1}`
      : item.year
        ? String(item.year)
        : "";
  return [context, QUEUE_STATUS[item.queueStatus ?? ""]].filter(Boolean).join(" · ");
}

/**
 * Last measured row geometry per card shape and window width. A remounted
 * row (Back to Home, say) starts from it, so it neither mounts cards for the
 * landscape fallback pitch nor re-renders once it has measured itself.
 */
const measuredMetrics = new Map<string, { pitch: number; gap: number }>();
const metricsKey = (shape: CardShape) =>
  `${shape}:${typeof window === "undefined" ? 0 : window.innerWidth}`;

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
 * `shape` selects poster or landscape art for the responsive layout; live
 * channels keep their landscape logo cards and the TV is always landscape.
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
}) {
  const track = useRef<HTMLDivElement>(null);
  // Live rows are short, and their phone logo tiles take each logo's own
  // width, which a fixed-pitch window cannot address.
  const liveRow = list.length > 0 && list.every((item) => item.type === "live");
  const windowedRow = responsive && windowed === true && !liveRow;
  // Measured per layout: the pitch between consecutive cards and the gap
  // around the spacers. Read during render from the last measurement; every
  // measurement is followed by a re-render, so the spacers never render
  // against stale geometry for more than the pre-measure commit.
  // A row of live channels stays a landscape row even where posters are set.
  const posterRow = responsive && shape === "poster" && list.some((item) => item.type !== "live");
  const rowShape: CardShape = posterRow ? "poster" : "landscape";
  const metrics = useRef(measuredMetrics.get(metricsKey(rowShape)) ?? { pitch: CARD_PITCH, gap: CARD_GAP });
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
    // Direct children only: the responsive wrapper's own inner .media-card
    // would otherwise pair with it and measure a bogus zero-width pitch.
    const cards = node.querySelectorAll<HTMLElement>(":scope > .responsive-card, :scope > .media-card");
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
    // spacers never keep the pre-measure fallback geometry (poster rows are
    // far narrower than the landscape fallback).
    const remeasured =
      metrics.current.pitch !== previousMetrics.pitch || metrics.current.gap !== previousMetrics.gap;
    measuredMetrics.set(metricsKey(rowShape), metrics.current);
    setRange((previous) =>
      !remeasured && previous.start === next.start && previous.end === next.end ? previous : next,
    );
  }, [list.length, rowShape]);

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
    <div className={`cards ${posterRow ? "poster-grid" : ""}`} data-scroll-id={`cards-${prefix}`} ref={track}>
      {leftSpacer > 0 && <div aria-hidden="true" style={{ flex: `0 0 ${leftSpacer}px` }} />}
      {visible.map((item, localIndex) => {
        const i = offset + localIndex;
        const inQueue = prefix === "queue" || (screen === "My List" && libraryQueue);
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
        const meta = responsive ? cardMeta(item) : "";
        const poster = responsive && shape === "poster" && item.type !== "live";
        const logo = !poster && presentation.imageRole === "logo";
        const card = <TvButton
          className={`media-card ${poster ? "poster-card" : logo ? "logo-card" : ""} ${(presentation.progress ?? 0) > 0 ? "has-progress" : ""}`}
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
          key={`${item.type}-${item.id}`}
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
          {poster
            ? <SharedPosterThumbnail item={item} context={context} initial={presentation} progress={presentation.progress} />
            : <SharedCardThumbnail item={item} context={context} initial={presentation} progress={presentation.progress} />}
          <strong>
            <RokuText>{presentation.title}</RokuText>
          </strong>
          <small>
            <RokuText speed={42}>
              {presentation.subtitle}
            </RokuText>
          </small>
          {/* Phones caption the art with the title and minimal context in
              place of the wider layouts' text rows; live logo tiles carry
              no caption at all. */}
          {responsive && !logo && (
            <span className="card-caption" aria-hidden="true">
              <span className="card-title">{presentation.title}</span>
              {meta && <span className="card-meta">{meta}</span>}
            </span>
          )}
        </TvButton>;
        return responsive ? <div className={`responsive-card ${poster ? "poster" : logo ? "logo" : ""}`} key={`${item.type}-${item.id}`}>{card}</div> : card;
      })}
      {rightSpacer > 0 && <div aria-hidden="true" style={{ flex: `0 0 ${rightSpacer}px` }} />}
    </div>
  );
});
