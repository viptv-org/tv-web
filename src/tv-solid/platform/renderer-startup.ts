import { createRenderer, loadFonts, registerDefaultShaders } from "@solidtv/solid";
import { prefetchFont, type RendererMain } from "@solidtv/renderer";
import { sdfFonts } from "../fonts";
import {
  prepareBrowserRenderer,
  prepareCanvasRenderer,
  type BrowserRendererHost,
} from "./browser-renderer";

type RendererSetup = ReturnType<typeof createRenderer>;
export type BrowserRendererSetup = RendererSetup & { host: BrowserRendererHost };

interface StartupOptions<T> {
  settings: NonNullable<Parameters<typeof createRenderer>[0]>;
  target: string | HTMLElement;
  ready: Promise<T>;
  onRenderer?: (setup: BrowserRendererSetup) => void;
  mount: (setup: BrowserRendererSetup, ready: T) => void;
}

class StartupContextLost extends Error {}

async function attempt<T>(host: BrowserRendererHost, options: StartupOptions<T>): Promise<void> {
  let setup: RendererSetup | undefined;
  let lost = false;
  let rejectLoss!: (error: Error) => void;
  const contextLost = new Promise<never>((_resolve, reject) => {
    rejectLoss = reject;
  });
  void contextLost.catch(() => {});
  const onLost = () => {
    lost = true;
    rejectLoss(new StartupContextLost("Graphics context lost during startup"));
  };
  if (host.mode === "webgl") host.canvas.addEventListener("webglcontextlost", onLost);
  try {
    if (host.isContextLost?.()) throw new StartupContextLost();
    setup = createRenderer({ ...options.settings, canvas: host.canvas }, options.target);
    const renderer = setup.renderer as RendererMain;
    if (host.mode === "webgl") renderer.on("contextLost", onLost);
    if (lost || host.isContextLost?.()) throw new StartupContextLost();
    host.canvas.style.position = "absolute";
    host.canvas.style.left = "50%";
    host.canvas.style.top = "50%";
    host.canvas.style.transform = "translate(-50%, -50%)";
    registerDefaultShaders(renderer);
    options.onRenderer?.({ ...setup, host });
    // A constructed stage immediately claims the parallel font prefetches.
    if (host.mode === "webgl") for (const font of sdfFonts) prefetchFont(font);
    const fonts = host.loadFonts ? host.loadFonts(renderer) : loadFonts(sdfFonts);
    const [, ready] = await Promise.race([Promise.all([fonts, options.ready]), contextLost]);
    if (lost || host.isContextLost?.()) throw new StartupContextLost();
    options.mount({ ...setup, host }, ready);
  } catch (error) {
    const contextFailure = lost || !!host.isContextLost?.() || error instanceof StartupContextLost;
    try {
      if (setup) host.dispose(setup.renderer);
    } catch (cleanupError) {
      if (!contextFailure) throw cleanupError;
    } finally {
      host.canvas.remove();
    }
    if (contextFailure) throw new StartupContextLost();
    throw error;
  } finally {
    host.canvas.removeEventListener("webglcontextlost", onLost);
    if (setup && host.mode === "webgl") (setup.renderer as RendererMain).off("contextLost", onLost);
  }
}

export async function startBrowserRenderer<T>(options: StartupOptions<T>): Promise<void> {
  void options.ready.catch(() => {});
  const host = await prepareBrowserRenderer();
  try {
    await attempt(host, options);
  } catch (error) {
    if (!(error instanceof StartupContextLost) || host.mode !== "webgl") throw error;
    await attempt(await prepareCanvasRenderer(), options);
  }
}
