import { setRendererFactory } from "@solidtv/solid";
import type { RendererMain } from "@solidtv/renderer";

export async function prepareBrowserRenderer() {
  const canvas = document.createElement("canvas");
  let webgl = false;
  try {
    const options = { alpha: true, antialias: false, depth: false, stencil: false, desynchronized: false, preserveDrawingBuffer: false, premultipliedAlpha: true, powerPreference: "high-performance" as const };
    webgl = !!(canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options));
  } catch { /* Unsupported contexts can throw on embedded browsers. */ }
  if (webgl) {
    setRendererFactory(undefined);
    return { canvas, mode: "webgl" as const, loadFonts: undefined };
  }
  if (!canvas.getContext("2d")) throw new Error("No supported TV graphics context");
  const fallback = await import("./canvas-renderer");
  setRendererFactory((settings, root) => fallback.createCanvasRenderer(settings, root) as unknown as RendererMain);
  return { canvas, mode: "canvas" as const, loadFonts: fallback.loadCanvasFonts };
}
