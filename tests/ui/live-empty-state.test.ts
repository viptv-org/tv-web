import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { AccountIdentity } from "../../src/tv-solid/remote/api";
import {
  LIVE_ANSWER_T,
  LIVE_EMPTY_COPY,
  LIVE_FILTERED_LINE,
  LIVE_NO_SOURCE_T,
  LIVE_PAGE_HEIGHT,
  LIVE_PAGE_TOP,
  LIVE_ROW_TOP,
  liveEmptyArtworkSrc,
  liveFailureBody,
  liveKeepsToday,
  liveFilteredChip,
  liveNoChannelsBody,
  liveNoSourceActions,
  liveRecoveryActions,
  liveViewerOf,
  liveWhoLine,
  pickLiveSpread,
  type LiveFacts,
} from "../../src/tv-solid/remote/liveEmpty";

/** The page's own facts for one of the contract's states. */
const facts = (overrides: Partial<LiveFacts> = {}): LiveFacts => ({
  channels: 0,
  page: undefined,
  filtered: false,
  pending: false,
  failure: "",
  ...overrides,
});
const answered = (overrides: Partial<LiveFacts> = {}) =>
  facts({
    page: { availability: "Available" },
    ...overrides,
  });

describe("Live empty, loading and failed states (LIVE-EMPTY-001)", () => {
  it("picks the state from the page's own facts in the contract's order", () => {
    // 1. Any channels: today's page, even with a filter applied.
    expect(pickLiveSpread(facts({ channels: 3 }))).toBe("today");
    expect(pickLiveSpread(facts({ channels: 3, filtered: true }))).toBe("today");
    // 2. A filter wins over every empty form.
    expect(
      pickLiveSpread(
        answered({ filtered: true, page: { availability: "NeedsConfiguration" } }),
      ),
    ).toBe("filtered");
    // 3. No page and a request in flight: still loading.
    expect(pickLiveSpread(facts({ pending: true }))).toBe("loading");
    // 4. No page and no request open after a failure: the failed form.
    expect(pickLiveSpread(facts({ failure: "Failed to fetch" }))).toBe("failed");
    // 5. The page answered NeedsConfiguration: no source.
    expect(
      pickLiveSpread(
        answered({ page: { availability: "NeedsConfiguration" } }),
      ),
    ).toBe("no-source");
    // 6. Connections but zero channels while the request is open: loading.
    expect(pickLiveSpread(answered({ pending: true }))).toBe("loading");
    // 7. Connections and zero channels after the answer: no channels.
    expect(pickLiveSpread(answered())).toBe("no-channels");
  });

  it("never claims a source is missing before a request has proved anything", () => {
    // No page and no failure yet is not proof of an unconfigured account.
    expect(pickLiveSpread(facts())).toBe("loading");
    // A page that is loading outranks its own absence of channels.
    expect(pickLiveSpread(answered({ pending: true, channels: 0 }))).toBe(
      "loading",
    );
  });

  it("keeps today's page and today's filtered line outside the new states", () => {
    expect(liveKeepsToday("today")).toBe(true);
    expect(liveKeepsToday("filtered")).toBe(true);
    for (const spread of ["loading", "failed", "no-source", "no-channels"] as const)
      expect(liveKeepsToday(spread)).toBe(false);
  });

  it("names the chosen filter on a page it emptied, not the source", () => {
    // copy.md § Empty states, Live, empty category, in its TV/desktop form.
    expect(LIVE_FILTERED_LINE).toBe(
      "No channels here yet. Choose another filter.",
    );
    // The chips are the page's only stop, so one is always focused (All is 0).
    const groups = [{ id: "group-1" }, { id: "group-2" }];
    expect(liveFilteredChip(groups, "group-1")).toBe(1);
    expect(liveFilteredChip(groups, "group-2")).toBe(2);
    expect(liveFilteredChip(groups, undefined)).toBe(0);
    expect(liveFilteredChip(groups, "retired-group")).toBe(0);
    expect(liveFilteredChip([], undefined)).toBe(0);
  });

  it("carries the contract's copy word for word", () => {
    // design-contract/viptv-design-system/copy.md § Empty states, the four
    // LIVE-EMPTY-001 rows.
    expect(LIVE_EMPTY_COPY.eyebrow).toBe("LIVE TV");
    expect(LIVE_EMPTY_COPY.headline).toBe("Live TV isn't set up yet.");
    expect(LIVE_EMPTY_COPY.body).toBe(
      "Add an IPTV connection with Xtream or M3U, or install a live add-on. Channels, the guide and favourites appear here.",
    );
    expect(LIVE_EMPTY_COPY.setup).toBe("Set up live TV");
    expect(LIVE_EMPTY_COPY.addOns).toBe("Add-ons");
    expect(LIVE_EMPTY_COPY.memberLine).toBe(
      "Only the household owner can set up live TV.",
    );
    expect(LIVE_EMPTY_COPY.deviceLine).toBe(
      "Manage live TV from a signed-in phone, computer or the web dashboard.",
    );
    expect(LIVE_EMPTY_COPY.noChannelsHeadline).toBe("No channels came back.");
    expect(LIVE_EMPTY_COPY.noChannelsBody).toBe(
      "This source is set up, but it isn't sending channels.",
    );
    expect(LIVE_EMPTY_COPY.retry).toBe("Try again");
    expect(LIVE_EMPTY_COPY.sourceIntegrations).toBe("Source integrations");
  });

  it("reads the failure headline and its generic body from the contract", () => {
    // "Could not load Live TV." is a failure, never an empty answer.
    expect(LIVE_EMPTY_COPY.failedHeadline).toBe("Could not load Live TV.");
    expect(LIVE_EMPTY_COPY.failedBody).toBe("Something went wrong. Try again.");
    expect(liveFailureBody("")).toBe("Something went wrong. Try again.");
    expect(liveFailureBody("   ")).toBe("Something went wrong. Try again.");
    // The message the request read is shown instead.
    expect(liveFailureBody("The TV could not complete this request.")).toBe(
      "The TV could not complete this request.",
    );
    expect(liveFailureBody("Failed to fetch")).toBe("Failed to fetch");
  });

  it("uses the server's own reason for no channels, else the neutral line", () => {
    expect(liveNoChannelsBody({ reason: "Provider sign-in expired" })).toBe(
      "Provider sign-in expired",
    );
    expect(liveNoChannelsBody({ reason: "  " })).toBe(
      "This source is set up, but it isn't sending channels.",
    );
    expect(liveNoChannelsBody(undefined)).toBe(
      "This source is set up, but it isn't sending channels.",
    );
    // The failed form must never fall back to the no-channels copy.
    expect(liveNoChannelsBody({})).not.toBe(LIVE_EMPTY_COPY.failedBody);
  });
});

describe("Live empty state identity (LIVE-EMPTY-001A actions)", () => {
  const identity = (value: AccountIdentity | undefined) =>
    liveViewerOf(value);

  it("gives an owner's account session both setup actions", () => {
    expect(identity({ role: "owner", manageAccount: true })).toBe("owner");
    expect(liveNoSourceActions("owner")).toEqual(["setup", "add-ons"]);
    expect(liveWhoLine("owner")).toBe("");
  });

  it("keeps the owner gate: the capability alone is not enough", () => {
    // A member session is never an owner form, whatever the capability says.
    expect(identity({ role: "member", manageAccount: false })).toBe("member");
    expect(identity({ role: "member", manageAccount: true })).toBe("member");
    // An owner the server did not confirm stays undecided instead of guessing.
    expect(identity({ role: "owner" })).toBeUndefined();
    expect(identity({ role: "owner", manageAccount: false })).toBeUndefined();
  });

  it("gives a member and a paired TV the who line and no action", () => {
    expect(liveNoSourceActions("member")).toEqual([]);
    expect(liveWhoLine("member")).toBe(LIVE_EMPTY_COPY.memberLine);
    expect(liveNoSourceActions("device")).toEqual([]);
    expect(liveWhoLine("device")).toBe(LIVE_EMPTY_COPY.deviceLine);
  });

  it("reserves the action block until the identity answers", () => {
    expect(identity(undefined)).toBeUndefined();
    expect(identity({})).toBeUndefined();
    expect(identity({ role: "owner-unknown" })).toBeUndefined();
    // The block is reserved, so it is neither an action nor a who line yet.
    expect(liveNoSourceActions(undefined)).toEqual([]);
    expect(liveWhoLine(undefined)).toBe("");
  });
});

describe("Live recovery actions (LIVE-EMPTY-001B)", () => {
  it("leads with Try again when there is something to retry", () => {
    expect(
      liveRecoveryActions({ retry: true, mayChangeSources: true }),
    ).toEqual(["retry", "source-integrations"]);
    expect(
      liveRecoveryActions({ retry: true, mayChangeSources: false }),
    ).toEqual(["retry"]);
  });

  it("drops Source integrations when the viewer may not change sources", () => {
    expect(
      liveRecoveryActions({ retry: false, mayChangeSources: false }),
    ).toEqual([]);
    expect(
      liveRecoveryActions({ retry: false, mayChangeSources: true }),
    ).toEqual(["source-integrations"]);
  });
});

describe("Live empty state geometry (contract T row, 1920 × 1080)", () => {
  it("centres the no-source text block in the page area under the navigation", () => {
    const T = LIVE_NO_SOURCE_T;
    expect(LIVE_PAGE_TOP).toBe(132);
    expect(LIVE_PAGE_HEIGHT).toBe(948);
    // The block is 236 to 712 in page-area coordinates: 476 tall, centred.
    const top = T.eyebrow.y;
    const bottom = T.secondary.y + T.secondary.h;
    expect(top).toBe(236);
    expect(bottom).toBe(712);
    expect(top).toBe(Math.round((LIVE_PAGE_HEIGHT - (bottom - top)) / 2));
    // The whole block keeps the Live page's own 96 inset.
    for (const box of [T.eyebrow, T.headline, T.body, T.primary, T.secondary])
      expect(box.x).toBe(96);
    // Gaps, in the contract's order.
    expect(T.headline.y - (T.eyebrow.y + T.eyebrow.h)).toBe(18);
    expect(T.body.y - (T.headline.y + T.headlineLine * T.headlineLines)).toBe(
      22,
    );
    expect(T.primary.y - (T.body.y + T.bodyLine * T.bodyLines)).toBe(34);
    expect(T.secondary.y - (T.primary.y + T.primary.h)).toBe(14);
  });

  it("draws the actions on the contract's primary and secondary metrics", () => {
    const T = LIVE_NO_SOURCE_T;
    expect(T.primary.h).toBe(72);
    expect(T.primaryRadius).toBe(36);
    expect(T.primaryPadding).toBe(34);
    expect(T.primarySize).toBe(26);
    expect(T.secondary.h).toBe(52);
    expect(T.secondaryRadius).toBe(26);
    expect(T.secondaryPadding).toBe(24);
    expect(T.secondarySize).toBe(22);
    // The who line takes the action block's place, so the copy never moves.
    expect(T.who.y).toBe(T.primary.y);
    expect(T.who.w).toBe(T.body.w);
  });

  it("scrims the wide crop with the contract's stops, never its own", () => {
    expect(LIVE_NO_SOURCE_T.scrim).toEqual([
      { at: 0, alpha: 0.92 },
      { at: 0.45, alpha: 0.6 },
      { at: 1, alpha: 0.18 },
    ]);
    expect(LIVE_NO_SOURCE_T.artwork).toEqual({
      x: 0,
      y: 0,
      w: 1920,
      h: LIVE_PAGE_HEIGHT,
    });
  });

  it("starts the answered block at the page column's top padding", () => {
    // T x 96, top 60: 132 + 60 on the canvas, with the headline at 44/700.
    expect(LIVE_ANSWER_T.headline.x).toBe(96);
    expect(LIVE_ANSWER_T.headline.y).toBe(60);
    expect(LIVE_ANSWER_T.headlineSize).toBe(44);
    expect(LIVE_ANSWER_T.headlineLine).toBe(50);
    expect(LIVE_ANSWER_T.bodySize).toBe(24);
    expect(LIVE_ANSWER_T.bodyLine).toBe(34);
    // The body sits under the two-line headline, the actions under the body.
    expect(LIVE_ANSWER_T.body.y).toBe(
      LIVE_ANSWER_T.headline.y +
        LIVE_ANSWER_T.headlineLine * LIVE_ANSWER_T.headlineLines +
        22,
    );
    expect(LIVE_ANSWER_T.primary.y).toBe(
      LIVE_ANSWER_T.body.y + LIVE_ANSWER_T.bodyLine * LIVE_ANSWER_T.bodyLines + 34,
    );
    expect(LIVE_ANSWER_T.secondary.y).toBe(
      LIVE_ANSWER_T.primary.y + LIVE_NO_SOURCE_T.primary.h + 14,
    );
    // The block never runs into the skeleton rows' start on the canvas.
    expect(
      LIVE_PAGE_TOP +
        LIVE_ANSWER_T.secondary.y +
        LIVE_NO_SOURCE_T.secondary.h,
    ).toBeLessThan(LIVE_ROW_TOP);
  });
});



describe("Live empty artwork (contract § Artwork)", () => {
  it("loads the contract's wide crop through the app's asset path", () => {
    expect(liveEmptyArtworkSrc()).toBe(
      "/assets/photography/live-empty-wide.webp",
    );
  });

  it("ships the contract's exact bytes", async () => {
    const wide = await readFile("public/assets/photography/live-empty-wide.webp");
    expect(wide.byteLength).toBe(173026);
    expect(createHash("sha256").update(wide).digest("hex")).toBe(
      "aa34ba0293dcb726421ffc79266716f91cc5b3caf779d10492b8a7ba1c89aa11",
    );
    const tall = await readFile("public/assets/photography/live-empty-tall.webp");
    expect(createHash("sha256").update(tall).digest("hex")).toBe(
      "c212f2497a81515de0a4edb55c68c34ae43d018a85a6cbfa61c0e46e2b7ebefc",
    );
  });
});