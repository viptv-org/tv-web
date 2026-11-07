/**
 * LIVE-EMPTY-001 — the Live page's own facts pick its empty, loading and failed
 * forms, and this module owns the contract's copy and geometry for them.
 *
 * Source: the pinned design contract (design `8b7f859`),
 * `specs/behavior/live-empty-state.md` (the state table, § no source,
 * § sources-no-channels, § layout) and
 * `viptv-design-system/copy.md` § Empty states. Every string below is copied
 * verbatim from `copy.md`; do not paraphrase it here.
 *
 * The geometry is the contract's T (1920 × 1080, navigation 132 tall, page area
 * 1920 × 948, inset 96) row. The contract measures the no-source text block in
 * page-area coordinates (236 to 712 is the block vertically centred in 948), so
 * the boxes below are page-area y and the view adds `LIVE_PAGE_TOP`.
 */
import type { LivePage } from "./types";
import type { AccountIdentity } from "./api";

/** The page area under the TV navigation (contract § Layout, T row). */
export const LIVE_PAGE_TOP = 132;
export const LIVE_PAGE_HEIGHT = 948;
/** The Live page's own inset on T. */
export const LIVE_INSET = 96;

/**
 * The state the page draws. `today` and `filtered` are the page as it ships;
 * the other four are the contract's empty, loading and failed forms.
 */
export type LiveSpread =
  | "today"
  | "filtered"
  | "loading"
  | "failed"
  | "no-source"
  | "no-channels";

export interface LiveFacts {
  /** Channels in the adopted window. */
  channels: number;
  /** The first channel page, once the server has answered. */
  page?: Pick<LivePage, "availability" | "reason">;
  /** A filter is applied: Favourites on, or a group chosen. */
  filtered: boolean;
  /** A Live request is open. */
  pending: boolean;
  /** The message the failed first request read; empty when it did not fail. */
  failure: string;
}

/**
 * Which state the page shows. Only the page's own facts decide, in the
 * contract's order (spec § Which state the page shows):
 *
 * 1. any channels — today's page
 * 2. a filter applied — today's filtered-empty line
 * 3. no page and a request in flight — still loading
 * 4. no page and no request open, after a failure — the failed form
 * 5. the page answered `NeedsConfiguration` — no source
 * 6. zero channels with a request in flight — still loading
 * 7. zero channels after the page answered — no channels
 *
 * No page and no failure is not proof of anything yet, so it stays on the
 * loading form rather than claiming a source is missing.
 */
export function pickLiveSpread(facts: LiveFacts): LiveSpread {
  if (facts.channels > 0) return "today";
  if (facts.filtered) return "filtered";
  if (!facts.page) return facts.pending || !facts.failure ? "loading" : "failed";
  if (facts.page.availability === "NeedsConfiguration") return "no-source";
  return facts.pending ? "loading" : "no-channels";
}

/** The page as it ships: channels, or a filtered-empty line under its chips. */
export const liveKeepsToday = (spread: LiveSpread) =>
  spread === "today" || spread === "filtered";

/**
 * The chips row's index for the chosen group, `All` being 0. A page that is
 * empty only because of its filter has no channel row to hold the focus, so its
 * stop is the chosen chip and the remote stays somewhere it can act
 * (LIVE-EMPTY-11).
 */
export function liveFilteredChip(
  groups: readonly { id: string }[],
  group: string | undefined,
): number {
  return Math.max(0, groups.findIndex((value) => value.id === group) + 1);
}

/** Who is looking, once the account identity has answered. */
export type LiveViewer = "owner" | "member" | "device";

/**
 * The contract reads `account.role` and `capabilities.manage_account` together:
 * only an owner's account session may change household settings
 * (backend `04bcbfc` reports the capability for `role == "owner"` alone), so an
 * owner without the capability is not an owner form, and anything the server did
 * not say leaves the block reserved rather than guessing.
 */
export function liveViewerOf(
  identity: AccountIdentity | undefined,
): LiveViewer | undefined {
  if (!identity) return undefined;
  const { role, manageAccount } = identity;
  if (role === "member") return "member";
  if (role === "device") return "device";
  if (role === "owner" && manageAccount === true) return "owner";
  return undefined;
}

/** Everything the contract's § Copy row for these states owns. */
export const LIVE_EMPTY_COPY = {
  eyebrow: "LIVE TV",
  headline: "Live TV isn't set up yet.",
  body: "Add an IPTV connection with Xtream or M3U, or install a live add-on. Channels, the guide and favourites appear here.",
  setup: "Set up live TV",
  addOns: "Add-ons",
  memberLine: "Only the household owner can set up live TV.",
  deviceLine:
    "Manage live TV from a signed-in phone, computer or the web dashboard.",
  noChannelsHeadline: "No channels came back.",
  noChannelsBody: "This source is set up, but it isn't sending channels.",
  failedHeadline: "Could not load Live TV.",
  failedBody: "Something went wrong. Try again.",
  retry: "Try again",
  sourceIntegrations: "Source integrations",
} as const;

/**
 * The filtered-empty line, `copy.md` § Empty states "Live, empty category" in
 * the form it gives TV and desktop, where the row under the page is its filters.
 */
export const LIVE_FILTERED_LINE =
  "No channels here yet. Choose another filter.";

/** The no-source action block, by viewer (spec § No source, actions table). */
export type LiveNoSourceAction = "setup" | "add-ons";

export function liveNoSourceActions(
  viewer: LiveViewer | undefined,
): LiveNoSourceAction[] {
  // The owner's account session owns the household's sources. A member or a
  // paired TV cannot write one, so its line says so before the tap. An identity
  // that has not answered (or that the server would not name) holds the action
  // block's height empty rather than guessing, and this entry has no local mode
  // to fall back on: the TV wrapper requires an account.
  return viewer === "owner" ? ["setup", "add-ons"] : [];
}

/** The line that takes the action block's place when the viewer cannot act. */
export function liveWhoLine(viewer: LiveViewer | undefined): string {
  if (viewer === "member") return LIVE_EMPTY_COPY.memberLine;
  if (viewer === "device") return LIVE_EMPTY_COPY.deviceLine;
  return "";
}

/** The no-channels and failed block's actions, in order. */
export type LiveRecoveryAction = "retry" | "source-integrations";

/**
 * `retry` leads when there is something to retry: the failed first request
 * always, and an answered page only when it carried a failure reason. An answer
 * with no reason and no failure has nothing to re-request. **Source
 * integrations** follows whenever this viewer may change sources.
 */
export function liveRecoveryActions(facts: {
  retry: boolean;
  mayChangeSources: boolean;
}): LiveRecoveryAction[] {
  const actions: LiveRecoveryAction[] = [];
  if (facts.retry) actions.push("retry");
  if (facts.mayChangeSources) actions.push("source-integrations");
  return actions;
}

/** The no-channels body: the server's own human reason, else the neutral line. */
export function liveNoChannelsBody(page: Pick<LivePage, "reason"> | undefined) {
  const reason = page?.reason?.trim();
  return reason ? reason : LIVE_EMPTY_COPY.noChannelsBody;
}

/**
 * The failed body: the message the request read, else the contract's generic
 * line. The page never claims a source is set up here — nothing proved one is.
 */
export function liveFailureBody(failure: string) {
  const message = failure.trim();
  return message ? message : LIVE_EMPTY_COPY.failedBody;
}

/** One box on the 1920 × 1080 canvas, page-area y. */
export interface LiveBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * § No source (LIVE-EMPTY-001A), T row: 840-wide text block at x 96, vertically
 * centred 236–712; gaps 18 eyebrow→headline, 22 headline→body,
 * 34 body→primary, 14 primary→secondary.
 */
export const LIVE_NO_SOURCE_T = {
  artwork: { x: 0, y: 0, w: 1920, h: LIVE_PAGE_HEIGHT } satisfies LiveBox,
  textWidth: 840,
  bodyWidth: 820,
  eyebrow: { x: LIVE_INSET, y: 236, w: 840, h: 22 } satisfies LiveBox,
  eyebrowSize: 18,
  headline: { x: LIVE_INSET, y: 276, w: 840, h: 128 } satisfies LiveBox,
  headlineSize: 56,
  headlineLine: 64,
  headlineLines: 2,
  body: { x: LIVE_INSET, y: 426, w: 820, h: 114 } satisfies LiveBox,
  bodySize: 26,
  bodyLine: 38,
  bodyLines: 3,
  primary: { x: LIVE_INSET, y: 574, w: 340, h: 72 } satisfies LiveBox,
  primarySize: 26,
  primaryPadding: 34,
  primaryRadius: 36,
  secondary: { x: LIVE_INSET, y: 660, w: 220, h: 52 } satisfies LiveBox,
  secondarySize: 22,
  secondaryPadding: 24,
  secondaryRadius: 26,
  /** The who line takes the action block's place, so the copy never moves. */
  who: { x: LIVE_INSET, y: 574, w: 820, h: 38 } satisfies LiveBox,
  whoSize: 26,
  whoLine: 38,
  /** § Artwork: wide crop, left to right 92 %, 60 % at 45 %, 18 %. */
  scrim: [
    { at: 0, alpha: 0.92 },
    { at: 0.45, alpha: 0.6 },
    { at: 1, alpha: 0.18 },
  ],
} as const;

/**
 * § Sources, no channels (LIVE-EMPTY-001B), T row: the block starts at the page
 * column's own top padding (top 60), headline 44/700 line 50, body 24/400 line
 * 34, and each layout's primary and secondary geometry from the state above.
 * The headline→body gap follows the contract's 22.
 */
export const LIVE_ANSWER_T = {
  headline: { x: LIVE_INSET, y: 60, w: 1200, h: 100 } satisfies LiveBox,
  headlineSize: 44,
  headlineLine: 50,
  headlineLines: 2,
  body: { x: LIVE_INSET, y: 182, w: 1200, h: 68 } satisfies LiveBox,
  bodySize: 24,
  bodyLine: 34,
  bodyLines: 2,
  primary: { x: LIVE_INSET, y: 284, w: 300, h: 72 } satisfies LiveBox,
  secondary: { x: LIVE_INSET, y: 370, w: 420, h: 52 } satisfies LiveBox,
} as const;

/** Where the real Live channel rows begin, in canvas coordinates. */
export const LIVE_ROW_TOP = 636;

/** The shipped entry draws 1920 × 1080 only, so it always uses the wide crop. */
export const liveEmptyArtworkSrc = () =>
  `${import.meta.env.BASE_URL}assets/photography/live-empty-wide.webp`;