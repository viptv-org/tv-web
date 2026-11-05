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
export type TextMeasureContext = CanvasRenderingContext2D & {
  letterSpacing: string;
};

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
