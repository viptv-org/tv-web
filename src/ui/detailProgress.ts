import type { MediaItem } from "../api";
import { normalizeCore } from "../core";

export function enrichDetail(original: MediaItem, metadata: MediaItem): MediaItem {
  return normalizeCore("enrichDetail", { original, metadata });
}
export function mergeEpisodeProgress(episodes: readonly MediaItem[], history: readonly MediaItem[], seriesId: string): MediaItem[] {
  return normalizeCore("mergeEpisodeProgress", { episodes, history, seriesId });
}
export function initialEpisode(episodes: readonly MediaItem[], original: MediaItem): MediaItem | undefined {
  return normalizeCore<MediaItem | null>("initialEpisode", { episodes, original, now: Date.now() }) ?? undefined;
}
