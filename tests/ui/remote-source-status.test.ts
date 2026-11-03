import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SOURCE_PICKER_COPY,
  SOURCE_SPINNER_SIZE,
  SOURCE_SPINNER_STEP,
  SOURCE_SPINNER_TICK_MS,
  pickSourceSpread,
  sourceEmptyCopy,
  sourceSpinnerSrc,
  sourceStatusCopy,
  type SourcePickerFacts,
} from "../../src/tv-solid/remote/sourceStatus";
import { tokens } from "../../src/theme/viptv-tokens.generated";

const facts = (overrides: Partial<SourcePickerFacts> = {}): SourcePickerFacts => ({
  open: true,
  opening: false,
  discovering: false,
  rows: 0,
  ...overrides,
});

describe("TV source picker states (SRC-DRAWER-001, SRC-DRAWER-10)", () => {
  it("carries the contract's copy word for word", () => {
    // design-contract/viptv-design-system/copy.md:63-65, the "Sources,
    // in-progress label" and "Sources, none" rows.
    expect(SOURCE_PICKER_COPY.finding).toBe("Finding sources");
    expect(SOURCE_PICKER_COPY.checking).toBe("Still checking sources");
    expect(SOURCE_PICKER_COPY.none).toBe(
      "No sources available. Check your add-ons in Settings.",
    );
    // copy.md:32 and specs/behavior/source-drawer.md:89 — "Opening stream…"
    // with an ellipsis, not three dots.
    expect(SOURCE_PICKER_COPY.opening).toBe("Opening stream…");
    expect(SOURCE_PICKER_COPY.opening.endsWith("…")).toBe(true);
  });

  it("reads Finding sources while nothing has arrived", () => {
    // source-drawer.md:86: `Finding sources` while nothing has arrived yet.
    expect(pickSourceSpread(facts({ discovering: true }))).toBe("finding");
    expect(sourceStatusCopy("finding")).toBe("Finding sources");
  });

  it("reads Still checking sources once rows have arrived and discovery is in flight", () => {
    // source-drawer.md:87-88.
    expect(pickSourceSpread(facts({ discovering: true, rows: 2 }))).toBe(
      "checking",
    );
    expect(sourceStatusCopy("checking")).toBe("Still checking sources");
  });

  it("reads Opening stream… while a chosen stream opens", () => {
    // source-drawer.md:89-90: the chosen stream, not a timer, picks this state.
    expect(pickSourceSpread(facts({ opening: true, rows: 3 }))).toBe("opening");
    expect(sourceStatusCopy("opening")).toBe("Opening stream…");
    // Selecting a source aborts discovery, and a stale "still discovering"
    // fact never outranks the stream the viewer asked for.
    expect(
      pickSourceSpread(facts({ opening: true, discovering: true, rows: 3 })),
    ).toBe("opening");
    expect(pickSourceSpread(facts({ opening: true }))).toBe("opening");
  });

  it("hides the status line when the picker is idle", () => {
    // source-drawer.md:92-94 and 162-163: idle leaves no status line.
    expect(pickSourceSpread(facts({ rows: 4 }))).toBe("idle");
    expect(sourceStatusCopy("idle")).toBe("");
    expect(sourceEmptyCopy("idle")).toBe("");
  });

  it("draws nothing at all once the picker is closed", () => {
    // components.md § 9: the spinner and its words exist while the picker is
    // open, so a closed drawer cannot keep a status line, or its animation, up.
    expect(pickSourceSpread(facts({ open: false, discovering: true }))).toBe(
      "closed",
    );
    expect(
      pickSourceSpread(facts({ open: false, discovering: true, rows: 2 })),
    ).toBe("closed");
    expect(pickSourceSpread(facts({ open: false, rows: 4 }))).toBe("closed");
    expect(sourceStatusCopy("closed")).toBe("");
    expect(sourceEmptyCopy("closed")).toBe("");
  });

  it("reports the no-sources state without a status line", () => {
    // source-drawer.md:92-93: "the no-sources state ... [has] no status line",
    // and components.md:131 sends that state to the empty state instead.
    expect(pickSourceSpread(facts())).toBe("empty");
    expect(sourceStatusCopy("empty")).toBe("");
    expect(sourceEmptyCopy("empty")).toBe(
      "No sources available. Check your add-ons in Settings.",
    );
  });

  it("never shows the empty state while a request or a stream is open", () => {
    expect(sourceEmptyCopy(pickSourceSpread(facts({ discovering: true })))).toBe(
      "",
    );
    expect(sourceEmptyCopy(pickSourceSpread(facts({ opening: true })))).toBe("");
  });
});

describe("TV source status spinner (components.md § 9 Status line)", () => {
  it("draws the accent arc on the status track", () => {
    const src = sourceSpinnerSrc("#F5C542");
    const svg = decodeURIComponent(src.slice("data:image/svg+xml,".length));
    expect(src.startsWith("data:image/svg+xml,")).toBe(true);
    expect(svg).toContain('stroke="#F5C542"');
    expect(svg).toContain(`stroke="${tokens["color.status.spinner-track"]}"`);
    expect(svg).toContain(`width="${SOURCE_SPINNER_SIZE}"`);
    expect(svg).toContain(`height="${SOURCE_SPINNER_SIZE}"`);
  });

  it("keeps the panel's own colour when the accent changes", () => {
    const first = sourceSpinnerSrc("#F5C542");
    const second = sourceSpinnerSrc("#34D399");
    expect(first).not.toBe(second);
    expect(decodeURIComponent(second)).toContain('stroke="#34D399"');
  });

  it("turns in the sub-second, sub-radian steps the TV panel used", () => {
    expect(SOURCE_SPINNER_STEP).toBe(0.35);
    expect(SOURCE_SPINNER_TICK_MS).toBe(80);
    // One full turn is exactly divisible, so the angle never drifts.
    expect(Math.PI * 2).toBeGreaterThan(SOURCE_SPINNER_STEP);
  });
});

describe("The shipped TV entry runs this code (#34)", () => {
  const root = resolve(import.meta.dirname, "../..");
  const entry = readFileSync(
    resolve(root, "src/tv-solid/remote/App.tsx"),
    "utf8",
  );

  it("renders the contract's states from the shared module", () => {
    expect(entry).toContain('from "./sourceStatus"');
    expect(entry).toContain("pickSourceSpread({");
    expect(entry).toContain('open: overlay()?.kind === "sources"');
    expect(entry).toContain("sourceStatusCopy(sourceSpread())");
    expect(entry).toContain("sourceEmptyCopy(sourceSpread())");
    expect(entry).toContain("sourceSpinnerSrc(palette.accent)");
  });

  it("no longer invents a source-drawer status line", () => {
    // The invented "Finding sources · N sources so far" row, and the
    // paraphrase it replaced the contract's empty state with.
    expect(entry).not.toContain("sources so far");
    expect(entry).not.toContain("No sources found. Try again");
    // The copy lives in one place, so the panel cannot drift from it again.
    expect(entry).not.toContain('"Finding sources"');
    expect(entry).not.toContain('"Still checking sources"');
    expect(entry).not.toContain('"Opening stream…"');
  });

  it("drives Opening stream… from playback preparation, not a timer", () => {
    // `openingSource` is set around the awaited player start, so the state is
    // the real preparation window.
    expect(entry).toContain("[openingSource, setOpeningSource]");
    expect(entry).toContain("setOpeningSource(source);");
    expect(entry.indexOf("setOpeningSource(source);")).toBeLessThan(
      entry.indexOf("await player.start(current.card, source, current.resume)"),
    );
    expect(entry).toContain("opening: !!openingSource()");
  });
});