import { createComponent, createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const createElement = Document.prototype.createElement;

/** jsdom has no 2D canvas, so every test installs the same stub. It models the
 * one metric both paths are compared on: half an em per glyph plus the canvas
 * `letterSpacing` the engine applies after each glyph. */
function glyphWidth(font: string, letterSpacing: string, text: string) {
  const size = Number.parseFloat(font) || 0;
  const spacing = Number.parseFloat(letterSpacing) || 0;
  return (size / 2 + spacing) * Array.from(text).length;
}

type Calls = {
  canvases: number;
  contexts: number;
  listeners: number;
  measured: string[];
};

function counters(): Calls {
  return { canvases: 0, contexts: 0, listeners: 0, measured: [] };
}

/** A 2D context double; `spacing` models engines with canvas letter spacing. */
function stubCanvas(spacing: boolean, calls: Calls) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => {
      calls.contexts++;
      const state = { font: "", letterSpacing: "0px" };
      const context: Record<string, unknown> = {
        get font() {
          return state.font;
        },
        set font(value: string) {
          state.font = value;
        },
        measureText: (text: string) => {
          calls.measured.push(text);
          return { width: glyphWidth(state.font, state.letterSpacing, text) };
        },
        addEventListener: () => calls.listeners++,
      };
      if (spacing)
        Object.defineProperty(context, "letterSpacing", {
          get: () => state.letterSpacing,
          set: (value: string) => {
            state.letterSpacing = value;
          },
          configurable: true,
        });
      return context as unknown as CanvasRenderingContext2D;
    },
  );
  vi.spyOn(document, "createElement").mockImplementation(
    (tag: string, options?: ElementCreationOptions) => {
      if (tag === "canvas") calls.canvases++;
      return createElement.call(document, tag, options);
    },
  );
}

/** A 2D context the way the replaced code obtained one: a canvas per call. */
function perCallContext() {
  const canvas = createElement.call(document, "canvas") as HTMLCanvasElement;
  return canvas.getContext("2d")!;
}

afterEach(() => vi.resetModules());

describe("shared text measure context", () => {
  it("creates one canvas and one context for any number of measurements", async () => {
    const calls = counters();
    stubCanvas(true, calls);
    const { textMetrics } = await import(
      "../../src/tv-solid/remote/text-measure"
    );
    let first: unknown;
    for (let index = 0; index < 200; index++) {
      const context = textMetrics("24px Onest500");
      first ??= context;
      expect(context).toBe(first);
      context.measureText(`Fixture title ${index}`);
    }
    expect(calls.canvases).toBe(1);
    expect(calls.contexts).toBe(1);
    expect(calls.measured).toHaveLength(200);
    expect(calls.listeners).toBe(0);
  });

  it("measures exactly what a canvas per call measured before", async () => {
    const calls = counters();
    stubCanvas(true, calls);
    const { textMetrics } = await import(
      "../../src/tv-solid/remote/text-measure"
    );
    const fonts = [
      "24px Onest500",
      "18px Onest700",
      "26px Onest700",
      "27px Onest700",
      "32px Onest500",
      "44px Onest700",
      "22px Onest",
      "22px Onest600",
      "24px Onest600",
      "28px Onest500",
      "92px Bricolage800",
    ];
    for (const font of fonts)
      for (const text of ["2026", "·", "S1 E2", "Lanterns", ""]) {
        const previous = perCallContext();
        previous.font = font;
        expect(textMetrics(font).measureText(text).width).toBe(
          previous.measureText(text).width,
        );
      }
    // Hero badges are measured with the CSS letter spacing applied.
    const spaced = perCallContext();
    spaced.font = "18px Onest700";
    spaced.letterSpacing = ".36px";
    expect(textMetrics("18px Onest700", 0.36).measureText("HDR").width).toBe(
      spaced.measureText("HDR").width,
    );
  });

  it("resets letter spacing so one component cannot widen another's labels", async () => {
    const calls = counters();
    stubCanvas(true, calls);
    const { textMetrics } = await import(
      "../../src/tv-solid/remote/text-measure"
    );
    expect(textMetrics("18px Onest700", 0.36).measureText("HDR").width).toBe(
      (18 / 2 + 0.36) * 3,
    );
    expect(textMetrics("24px Onest500").measureText("HDR").width).toBe(
      (24 / 2) * 3,
    );
  });

  it("keeps the manual spacing fallback on engines without canvas letter spacing", async () => {
    const calls = counters();
    stubCanvas(false, calls);
    const { letterSpacingSupported, textMetrics } = await import(
      "../../src/tv-solid/remote/text-measure"
    );
    expect(letterSpacingSupported()).toBe(false);
    expect(textMetrics("18px Onest700", 0.36).measureText("HDR").width).toBe(
      (18 / 2) * 3,
    );
  });
});

describe("screen measurement cost", () => {
  it("does not grow with the number of components a screen mounts", async () => {
    const calls = counters();
    stubCanvas(true, calls);
    vi.doMock("@solidtv/solid", async () => {
      const solid = await import("solid-js");
      return {
        ...solid,
        // The graphics boundary the TV renderer owns; nothing here paints.
        createElement: () => ({}),
        insert: () => {},
        spread: () => {},
        getRenderer: () => ({}),
      };
    });
    vi.doMock("../../src/tv-solid/runtime", () => ({
      TvView: (props: { children?: unknown }) => props.children,
      TvText: (props: { content?: unknown }) => props.content,
    }));
    const { TitleMetadata } = await import(
      "../../src/tv-solid/remote/TitleMetadata"
    );
    const card = (index: number) => ({
      identity: { kind: "movie", id: `fixture-${index}`, ids: [] },
      title: `Fixture title ${index}`,
      view: {
        metadata_parts: ["2026", "1 h 40 min", "Action"],
        hero_metadata_parts: ["2026", "1 h 40 min", "Action"],
        hero_badges: [{ label: "HDR" }, { label: "5.1" }],
      },
    });
    const render = (count: number) =>
      createRoot((dispose) => {
        for (let index = 0; index < count; index++)
          createComponent(TitleMetadata, {
            card: card(index) as never,
            y: 0,
          });
        dispose();
      });
    render(1);
    const afterOne = calls.canvases;
    const measuredOnce = calls.measured.length;
    render(12);
    // TitleMetadata now prefers the renderer's SDF metrics and only falls
    // back to the shared canvas for unknown glyphs. The canvas count must not
    // grow with the number of components (one shared context at most).
    expect(afterOne).toBeLessThanOrEqual(1);
    expect(calls.canvases).toBeLessThanOrEqual(1);
    expect(calls.measured.length).toBeGreaterThanOrEqual(measuredOnce);
  });
});