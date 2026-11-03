import { tokens } from "../../theme/viptv-tokens.generated";

/**
 * The TV source picker's status line and empty state.
 *
 * Contract: design-contract/specs/behavior/source-drawer.md § "No best-match
 * hint" (and acceptance SRC-DRAWER-10), with the words from
 * design-contract/viptv-design-system/copy.md: the source picker status
 * sentence on line 32 and the "Sources, in-progress label" / "Sources, none"
 * rows on lines 63-65.
 *
 * TV keeps a status line under the list, with a spinner, only while it is
 * working: `Finding sources` while nothing has arrived, `Still checking
 * sources` once sources have arrived but discovery is still in flight, and
 * `Opening stream…` while a chosen stream opens. An idle picker, the
 * no-sources state and the torrent-only state have no status line.
 */
export const SOURCE_PICKER_COPY = {
  finding: "Finding sources",
  checking: "Still checking sources",
  opening: "Opening stream…",
  none: "No sources available. Check your add-ons in Settings.",
} as const;

/** The three working states the contract names, plus the ones it hides. */
export type SourcePickerSpread =
  | "closed"
  | "finding"
  | "checking"
  | "opening"
  | "idle"
  | "empty";

/** What the drawer's own facts say, so the copy is never chosen by a timer. */
export interface SourcePickerFacts {
  /** The source drawer is the overlay on screen. */
  open: boolean;
  /** A chosen source is being prepared for playback. */
  opening: boolean;
  /** The discovery request is still in flight. */
  discovering: boolean;
  /** How many rows have arrived so far. */
  rows: number;
}

/**
 * The state the drawer is in, in the contract's order.
 *
 * The line exists only while the picker is open (components.md § 9, "while the
 * picker is open"), so a closed drawer draws nothing. A chosen stream opening
 * outranks discovery: selecting a source aborts the discovery scope, but the
 * status must report the stream the viewer asked for. Discovery with no row is
 * `Finding sources`; with a row it is `Still checking sources`. Once discovery
 * is over, rows leave the line absent (idle) and no rows leave the empty state,
 * which carries no status line.
 */
export function pickSourceSpread(facts: SourcePickerFacts): SourcePickerSpread {
  if (!facts.open) return "closed";
  if (facts.opening) return "opening";
  if (facts.discovering) return facts.rows > 0 ? "checking" : "finding";
  return facts.rows > 0 ? "idle" : "empty";
}

/** The status line's words, or "" when the contract hides the line. */
export function sourceStatusCopy(spread: SourcePickerSpread): string {
  return spread === "finding" || spread === "checking" || spread === "opening"
    ? SOURCE_PICKER_COPY[spread]
    : "";
}

/** The list's words when discovery finished without a row, else "". */
export function sourceEmptyCopy(spread: SourcePickerSpread): string {
  return spread === "empty" ? SOURCE_PICKER_COPY.none : "";
}

/** The status line's spinner matches the 22px status words beside it. */
export const SOURCE_SPINNER_SIZE = 22;

/**
 * The accent arc on the status track, drawn beside the status words. The
 * accent is the profile's server-owned one, so the arc is built per colour
 * rather than baked into the bundle.
 */
export function sourceSpinnerSrc(
  accent: string,
  track: string = tokens["color.status.spinner-track"],
): string {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SOURCE_SPINNER_SIZE}" height="${SOURCE_SPINNER_SIZE}" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" stroke="${track}" stroke-width="3"/><path d="M11 3a8 8 0 0 1 8 8" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/></svg>`,
    )
  );
}

/** One spinner step; the legacy Tv3 panel turned 0.35 rad every 80 ms. */
export const SOURCE_SPINNER_STEP = 0.35;
export const SOURCE_SPINNER_TICK_MS = 80;