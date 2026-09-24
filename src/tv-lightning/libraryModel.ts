import type { MediaItem } from "../api";
import { artworkUrl, cardPresentation } from "../core/presentations";
import { continueMeta } from "../components/cards/cardText";
import { discoverCard, type DiscoverCardView } from "./discoverModel";

/** The TV My List grid uses the same landscape tile as Discover. */
export function libraryCard(item: MediaItem, queue: boolean): DiscoverCardView {
  if (!queue) return discoverCard(item);
  const card = cardPresentation(item, "queue");
  return {
    id: item.id,
    title: card.title,
    subtitle: continueMeta(item, card),
    image: artworkUrl(card.image ?? undefined, 320, 180, false, card.imageRole === "logo") ?? card.image ?? "",
    progress: card.progress ?? 0,
  };
}
