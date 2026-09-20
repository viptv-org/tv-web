import { memo, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
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

/**
 * One memoized row of media cards for every screen. Unrelated App re-renders
 * (hero swaps, busy toggles, player state) must not re-run per-card WASM
 * normalization for hundreds of cards, so this row re-renders only when its
 * list, prefix, screen or queue context actually changes. Actions come from
 * a ref so fresh closures never break the memo.
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
}: {
  list: readonly MediaItem[];
  prefix: string;
  screen: Screen;
  responsive: boolean;
  libraryQueue: boolean;
  actions: MutableRefObject<CardActions>;
  searchKey: MutableRefObject<string>;
  setHighlighted: Dispatch<SetStateAction<MediaItem | undefined>>;
}) {
  return (
    <div className="cards" data-scroll-id={`cards-${prefix}`}>
      {list.map((item, i) => {
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
    </div>
  );
});
