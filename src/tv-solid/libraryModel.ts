import type { MediaItem } from "../api";
import { artworkUrl, cardPresentation, presentation } from "../core/presentations";
import { continueMeta } from "../components/cards/cardText";
import { discoverCard, type DiscoverCardView } from "./discoverModel";

/**
 * TV My List grid geometry: Continue Watching keeps four 360 × 202 stills per
 * row (three rows rendered); My List draws seven 200 × 300 posters per row and
 * keeps the focused row at the top, so two rows are rendered (the second peeks).
 */
export function libraryGrid(queue: boolean) {
  return queue
    ? { columns: 4, slots: 12, strideX: 404, strideY: 324 }
    : { columns: 7, slots: 14, strideX: 236, strideY: 422 };
}

/**
 * My List draws the saved poster in a 2:3 frame (TV-MYLIST-POSTER-001); a live
 * channel keeps its logo, contained. Continue Watching keeps the landscape tile.
 */
export function libraryPosterCard(item: MediaItem): DiscoverCardView {
  if (item.type === "live") return { ...discoverCard(item), logo: true };
  const card = cardPresentation(item, "catalog");
  const poster = presentation(item).posterImage ?? undefined;
  return {
    id: item.id,
    title: card.title,
    subtitle: card.subtitle,
    image: artworkUrl(poster, 200, 300) ?? poster ?? "",
    progress: 0,
  };
}

export function libraryCard(item: MediaItem, queue: boolean): DiscoverCardView {
  if (!queue) return libraryPosterCard(item);
  const card = cardPresentation(item, "queue");
  return {
    id: item.id,
    title: card.title,
    subtitle: continueMeta(item, card),
    image:
      artworkUrl(
        card.image ?? undefined,
        320,
        180,
        false,
        card.imageRole === "logo",
      ) ??
      card.image ??
      "",
    progress: card.progress ?? 0,
  };
}
