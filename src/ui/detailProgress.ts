import type { MediaItem } from "../api";
import { normalizeCore } from "../core";

export function enrichDetail(original: MediaItem, metadata: MediaItem): MediaItem {
  return normalizeCore("enrichDetail", { original, metadata });
}
export function mergeEpisodeProgress(episodes: readonly MediaItem[], history: readonly MediaItem[], seriesId: string): MediaItem[] {
  return normalizeCore("mergeEpisodeProgress", { episodes, history, seriesId });
}
/**
 * A series' episodes with its saved history applied. `history` is
 * `undefined` when the request failed: its rows are then unknown, not absent,
 * so the originating card's own resume point, the copy the user selected,
 * stands in for the row it names. A loaded history, even an empty one, is
 * authoritative and is never backfilled from the card; a card that names no
 * resume position contributes nothing, so no progress is invented.
 */
export function savedEpisodeProgress(
  episodes: readonly MediaItem[],
  history: readonly MediaItem[] | undefined,
  seriesId: string,
  original: MediaItem,
): MediaItem[] {
  if (history) return mergeEpisodeProgress(episodes, history, seriesId);
  const saved = (original.position ?? 0) > 0 ? [original] : [];
  return mergeEpisodeProgress(episodes, saved, seriesId);
}
export function initialEpisode(episodes: readonly MediaItem[], original: MediaItem): MediaItem | undefined {
  return normalizeCore<MediaItem | null>("initialEpisode", { episodes, original, now: Date.now() }) ?? undefined;
}
