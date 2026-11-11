import { setRendererFactory } from "@solidtv/solid";
import type { RendererMain } from "@solidtv/renderer";

export interface BrowserRendererHost {
  canvas: HTMLCanvasElement;
  mode: "webgl" | "canvas";
  dispose: (renderer: unknown) => void;
  isContextLost?: () => boolean;
  loadFonts?: (renderer: unknown) => Promise<unknown>;
}

export async function prepareCanvasRenderer(
  canvas = document.createElement("canvas"),
): Promise<BrowserRendererHost> {
  if (!canvas.getContext("2d")) throw new Error("No supported TV graphics context");
  const fallback = await import("./canvas-renderer");
  setRendererFactory(
    (settings, root) => fallback.createCanvasRenderer(settings, root) as unknown as RendererMain,
  );
  return {
    canvas,
    mode: "canvas",
    loadFonts: fallback.loadCanvasFonts,
    dispose: fallback.disposeCanvasRenderer,
  };
}

export async function prepareBrowserRenderer(): Promise<BrowserRendererHost> {
  const canvas = document.createElement("canvas");
  let webgl: WebGLRenderingContext | null = null;
  try {
    const options = {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      desynchronized: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance" as const,
    };
    webgl = (canvas.getContext("webgl", options) ||
      canvas.getContext("experimental-webgl", options)) as WebGLRenderingContext | null;
  } catch {
    /* Unsupported contexts can throw on embedded browsers. */
  }
  if (webgl) {
    const context = webgl;
    setRendererFactory(undefined);
    return {
      canvas,
      mode: "webgl",
      isContextLost: () => context.isContextLost(),
      dispose: (renderer) => (renderer as RendererMain).destroy(),
    };
  }
  return prepareCanvasRenderer(canvas);
}
