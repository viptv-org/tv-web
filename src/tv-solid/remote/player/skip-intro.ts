import type { Setter } from "solid-js";
import type { PlaybackSegment } from "../types";

/** Netflix offers Skip for six seconds, then withdraws it into the controls so
 * the button never sits over the film for the whole cold open. */
export const SKIP_OFFER_MS = 6000;
/** Withdrawing is a fade, not a cut. */
export const SKIP_FADE_MS = 200;
/** One rect, used by the standalone button and by the control row: the far
 * right of the row, where Next episode also appears. */
export const SKIP_BUTTON = { x: 1596, y: 846, width: 228, height: 56 };
/** Module-level so the renderer, which compares settings by identity, retargets
 * the same run instead of starting a new one. */
export const SKIP_FADE = { alpha: { duration: SKIP_FADE_MS, easing: "ease-out" } };

export type SkipOffer =
  /** On screen by itself, with the controls hidden. */
  | "button"
  /** Withdrawn to the control row: the action is still there, one press away. */
  | "controls"
  | "none";

/** Where the skip action lives. `elapsedMs` counts from the moment the segment
 * became current, so a new segment offers itself again. */
export function skipOffer(segment: PlaybackSegment | undefined, enabled: boolean, canSeek: boolean, elapsedMs: number): SkipOffer {
  if (!segment || !enabled || !canSeek) return "none";
  return elapsedMs < SKIP_OFFER_MS ? "button" : "controls";
}

export function skipLabel(segment: PlaybackSegment | undefined): string {
  return segment?.kind === "recap" ? "Skip recap" : "Skip intro";
}

/** The TV remote's play/pause key means skip while a segment is current, the
 * way Apple TV's player behaves. A dedicated pause key still pauses, and the
 * browser's Space keeps its own meaning. */
export function playKeySkips(segment: PlaybackSegment | undefined, enabled: boolean, canSeek: boolean): boolean {
  return Boolean(segment) && enabled && canSeek;
}

export interface SkipSeek {
  seek: (seconds: number) => Promise<void>;
  clearSegments: () => void;
  refreshSegments: () => Promise<void>;
  seeking: Setter<boolean>;
  showControls: Setter<boolean>;
  hideControls: () => void;
}

/** One implementation for Select, the remote's play key and the button: seek
 * past the segment, then hand the chrome back to the film. */
export async function skipSegment(segment: PlaybackSegment, actions: SkipSeek): Promise<void> {
  actions.showControls(true);
  actions.seeking(true);
  actions.clearSegments();
  try {
    await actions.seek(segment.end_ms / 1000);
    void actions.refreshSegments();
  } finally {
    actions.seeking(false);
    actions.hideControls();
  }
}
