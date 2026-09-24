import type { MediaItem } from "../../api";
import { tokens } from "../../theme/viptv-tokens.generated";

/**
 * The Up Next card (decisions.md 1): in an episode's final seconds the player
 * shows the next episode with a countdown instead of advancing silently.
 * Play now starts it at once, Cancel keeps watching this episode (no auto-next
 * for it), and the countdown reaching zero or the episode ending starts it.
 */
export type UpNextCard = {
  /** The playback session the card belongs to; a new session drops it. */
  readonly sessionId: string;
  /** Next episode metadata once known (still, number, title). */
  readonly item?: MediaItem;
  /** Seconds left on the countdown and the seconds it started from. */
  readonly left: number;
  readonly total: number;
};

/** The existing final-ten auto-next window (core policy `canAutoNext`). */
export const UP_NEXT_SECONDS = 10;
/** Countdown tick (motion.up-next-tick); the bar eases over one tick. */
export const UP_NEXT_TICK_MS = parseFloat(tokens["motion.up-next-tick"]) || 250;

const order = (item: MediaItem) => (item.season ?? 0) * 100000 + (item.episode ?? 0);

/**
 * The episode after `current` in a loaded episode list. The list must contain
 * the current episode itself, so a stale list from another series never names
 * the wrong episode; the backend's next-episode answer is the fallback.
 */
export function nextFromEpisodes(
  episodes: readonly MediaItem[],
  current: MediaItem | undefined,
): MediaItem | undefined {
  if (!current || !episodes.length) return undefined;
  const sorted = [...episodes].sort((a, b) => order(a) - order(b));
  const index = sorted.findIndex(
    (episode) =>
      episode.id === current.id ||
      (!!current.seriesId &&
        episode.seriesId === current.seriesId &&
        current.season !== undefined &&
        current.episode !== undefined &&
        episode.season === current.season &&
        episode.episode === current.episode),
  );
  return index >= 0 ? sorted[index + 1] : undefined;
}

/** "E2 · Please Don't Go" (the season is named when it changes). */
export function upNextLabel(next: MediaItem | undefined, current: MediaItem | undefined): string {
  if (!next) return "";
  const title = next.episodeTitle || next.title || next.name;
  const number = next.episode !== undefined ? `E${next.episode}` : "";
  const season =
    next.season !== undefined && current?.season !== undefined && next.season !== current.season
      ? `S${next.season}`
      : "";
  return [season, number, title].filter(Boolean).join(" · ");
}
