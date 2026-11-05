import type { Guide } from "./types";

/**
 * The Live guide's window is page state. Every row, the time header and the Now
 * marker read it, so one channel's pending or failed guide cannot move the grid.
 *
 * Source: the server's own window per guide response
 * (`backend/src/engine_v3/live.rs`, `window_start_millis` from the current half
 * hour); the client only aligns its fallback the same way.
 */
export interface GuideWindow {
  /** The grid's left edge. */
  start: number;
  /** The observation the Now marker is drawn at. */
  now: number;
}

/** The half hour every server window starts on. */
const ALIGN_MILLIS = 1_800_000;

/**
 * The window of the guides that have loaded: the earliest start they report and
 * the latest "now" any of them observed. Before one answers, the grid uses the
 * current half hour, which is the same rule the server applies, so the header
 * and the Now marker exist for as long as there are rows to draw.
 */
export function guideWindowOf(
  views: readonly (Guide["view"] | undefined)[],
  clock: number,
): GuideWindow {
  let start: number | undefined;
  let now: number | undefined;
  for (const view of views) {
    if (!view || !Number.isFinite(view.window_start_millis)) continue;
    start =
      start === undefined
        ? view.window_start_millis
        : Math.min(start, view.window_start_millis);
    if (!Number.isFinite(view.now_millis)) continue;
    now = now === undefined ? view.now_millis : Math.max(now, view.now_millis);
  }
  return {
    start: start ?? Math.floor(clock / ALIGN_MILLIS) * ALIGN_MILLIS,
    now: now ?? clock,
  };
}
