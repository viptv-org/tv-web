import { memo, useCallback, useLayoutEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { normalizeCore } from "../../core";
import { type CardPresentation, type MediaItem, type MediaSource } from "../../api";
import { RokuText } from "../../ui/RokuText";
import { TvButton } from "../../ui/remote";
import { SharedCardThumbnail } from "../../ui/RokuArtwork";
import type { Screen } from "../../ui/screens";

/**
 * Latest card action closures for the memoized card row: the row reads the
 * ref at click time so prop identities stay stable while App re-renders.
 */
export type CardActions = {
  play: (item: MediaItem, source?: MediaSource, position?: number) => unknown;
  discoverSources: (item: MediaItem, resume?: boolean) => unknown;
  detail: (item: MediaItem) => unknown;
  manage: (item: MediaItem) => void;
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
}) {
  const track = useRef<HTMLDivElement>(null);
  const windowedRow = responsive && windowed === true;
  // Measured per layout: the pitch between consecutive cards and the gap
  // around the spacers. Read during render from the last measurement; every
  // measurement is followed by a re-render, so the spacers never render
  // against stale geometry for more than the pre-measure commit.
  const metrics = useRef({ pitch: CARD_PITCH, gap: CARD_GAP });
  const [range, setRange] = useState(() => ({
    start: 0,
    end: Math.min(list.length, Math.ceil(1920 / CARD_PITCH) + WINDOW_BUFFER),
  }));

  const read = useCallback(() => {
    const node = track.current;
    if (!node) return;
    const cards = node.querySelectorAll<HTMLElement>(".responsive-card, .media-card");
    const first = cards[0];
    const second = cards[1];
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
    setRange((previous) =>
      previous.start === next.start && previous.end === next.end ? previous : next,
    );
  }, [list.length]);

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
    <div className="cards" data-scroll-id={`cards-${prefix}`} ref={track}>
      {leftSpacer > 0 && <div aria-hidden="true" style={{ flex: `0 0 ${leftSpacer}px` }} />}
      {visible.map((item, localIndex) => {
        const i = offset + localIndex;
        const inQueue = prefix === "queue" || (screen === "My List" && libraryQueue);
        const context = inQueue ? "queue" : "catalog";
        const presentation = normalizeCore<CardPresentation>("cardPresentation", { item, context });
        const current = actions.current;
        const activate = () => {
          switch (presentation.primaryAction) {
            case "play": return current.play(item);
            case "resume": case "next": return current.discoverSources(item, true);
            case "sources": return current.discoverSources(item);
            default: return current.detail(item);
          }
        };
        const card = <TvButton
          className={`media-card ${presentation.imageRole === "logo" ? "logo-card" : ""}`}
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
          <SharedCardThumbnail item={item} context={context} initial={presentation} progress={presentation.progress} />
          <strong>
            <RokuText>{presentation.title}</RokuText>
          </strong>
          <small>
            <RokuText speed={42}>
              {presentation.subtitle}
            </RokuText>
          </small>
        </TvButton>;
        return responsive ? <div className="responsive-card" key={`${item.type}-${item.id}`}>{card}</div> : card;
      })}
      {rightSpacer > 0 && <div aria-hidden="true" style={{ flex: `0 0 ${rightSpacer}px` }} />}
    </div>
  );
});
