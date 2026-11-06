/** One 2D context for every text measurement in the TV entry.
 *
 * Each component used to build a throwaway canvas and 2D context per
 * measurement: 37 canvases and 490 `measureText` calls per 48 Home keys on the
 * shipped entry, at ~0.065 ms per create+measure on a workstation. Creating a
 * context is the expensive part and all call sites measure the same handful of
 * faces, so one context is created on first use and reused for the app
 * lifetime.
 *
 * The context is deliberately never resized (assigning `width`/`height` resets
 * its state) and registers no listeners or textures, so there is nothing to
 * release. Measurements stay uncached: the faces load asynchronously, and a
 * width measured before a face is ready would be frozen as fallback metrics.
 *
 * Measurement must be synchronous. One context serves every component, so a
 * caller may not hold `font`/`letterSpacing` across an await or a yield; the
 * layout code here measures inside a single synchronous memo pass.
 *
 * The renderer lays SDF text out itself; this context is only for the layout
 * code that still measures DOM faces (navigation widths, guide columns).
 */
import { SDF_METRICS } from "./sdf-metrics";

export type TextMeasureContext = CanvasRenderingContext2D & {
  letterSpacing: string;
};

const fontPattern = /^\s*([\d.]+)px\s+['"]?([A-Za-z0-9]+)['"]?/;

/** The renderer lays text out from SDF atlases, not from DOM faces. Measuring
 * the canvas font here returned fallback metrics, which truncated the TV nav
 * and every pill whose width came from this context. Use the atlas advances and
 * ASCII kerning; unknown glyphs fall back to the real canvas measurement. */
export function sdfTextWidth(
  font: string,
  text: string,
  letterSpacing = 0,
): number | undefined {
  const match = fontPattern.exec(font);
  if (!match) return undefined;
  const size = Number(match[1]),
    family = match[2] === "Onest" ? "Onest400" : match[2],
    metrics = SDF_METRICS[family] ?? SDF_METRICS[family.replace(/Tabular$/, "")];
  if (!metrics) return undefined;
  let total = 0,
    previous = "";
  for (const character of Array.from(text)) {
    const advance = metrics.advance[character];
    if (advance === undefined) return undefined;
    total += advance;
    if (previous) total += metrics.kern[previous + character] ?? 0;
    previous = character;
  }
  return (
    (total * size) / metrics.size +
    Math.max(0, Array.from(text).length - 1) * letterSpacing
  );
}

let shared: TextMeasureContext | undefined;
let nativeSpacing = false;

/** True when the engine applies `letterSpacing` to measured advances, so the
 * caller can use CSS-parity widths instead of its manual spacing fallback. */
export function letterSpacingSupported(): boolean {
  measureContext();
  return nativeSpacing;
}

/** The shared measure context configured for `font` and `letterSpacing` in px.
 * Any previous caller's letter spacing is reset, so one component's spacing
 * cannot leak into another component's widths. */
export type SdfTextMeasureContext = {
  font: string;
  letterSpacing: number;
  measureText(text: string): { width: number };
};

/** A small mutable measurer for components whose widths come from the same SDF
 * faces the renderer draws. Callers may read/set `font` between measurements. */
export function sdfTextMetrics(
  font: string,
  letterSpacing = 0,
): SdfTextMeasureContext {
  const measure: SdfTextMeasureContext = {
    font,
    letterSpacing,
    measureText(text: string) {
      const width = sdfTextWidth(
        measure.font,
        String(text),
        measure.letterSpacing,
      );
      if (width !== undefined) return { width };
      const fallback = textMetrics(measure.font, measure.letterSpacing);
      return { width: fallback.measureText(String(text)).width };
    },
  };
  return measure;
}

export function textMetrics(
  font: string,
  letterSpacing = 0,
): TextMeasureContext {
  const context = measureContext();
  context.font = font;
  if (nativeSpacing) context.letterSpacing = `${letterSpacing}px`;
  return context;
}

function measureContext(): TextMeasureContext {
  if (!shared) {
    const context = document.createElement("canvas").getContext("2d");
    if (!context)
      throw new Error("The TV entry needs a 2D canvas context for text metrics");
    shared = context as TextMeasureContext;
    // Read the capability before this module ever writes the property, so an
    // engine without canvas letter spacing cannot report that it has it.
    nativeSpacing = "letterSpacing" in shared;

  }
  return shared;
}
