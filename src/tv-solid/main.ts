import './platform/tv-compat';
import {
  Config,
  createRenderer,
  loadFonts,
  registerDefaultShaders,
} from "@solidtv/solid";
import { createComponent } from "solid-js";
import type { RendererMain } from "@solidtv/renderer";
import { sdfFonts } from "./fonts";
import { tvShaderName } from "./shaders";
import { setRendererStart } from "./renderer-clock";
import { reloadImages } from "./remote/image-source";
import { prepareTizenHost } from "./platform/tizen-host";
import { prepareBrowserRenderer } from "./platform/browser-renderer";
import { installPs4Input } from "./platform/ps4-input";
import "../theme/viptv-tokens.generated.css";

import { RemoteTvApi } from "./remote/api";
import { createBrowserSessionStore } from "./platform/browser-session-store";

document.documentElement.dataset.renderer = "solid";
const platformParam = new URLSearchParams(location.search).get("platform");
const platform =
  platformParam === "vizio" ||
  platformParam === "webos" ||
  platformParam === "tizen"
    ? platformParam
    : "web";
const origin = import.meta.env.VITE_API_ORIGIN || location.origin;
const key = `viptv-device:${origin}`;

const api = new RemoteTvApi(
  origin,
  createBrowserSessionStore(key, () => localStorage, navigator.locks),
  undefined,
  platform,
);

async function start() {
  const removePs4Input = installPs4Input();
  if (new URLSearchParams(location.search).has("perfdebug"))
    performance.mark("viptv:init-start");
  // Prefetch each face once through SolidTV before synchronous WebGL setup.
  // The renderer attaches the prefetched faces when its stage is available.
  const dependencies = Promise.all([import("./remote/App"), prepareTizenHost(platform)]);
  const styles = Promise.all(
    Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][media="print"]')).map(
      (link) => link.sheet ? Promise.resolve() : new Promise<void>((resolve, reject) => {
        link.addEventListener("load", () => resolve(), { once: true });
        link.addEventListener("error", () => reject(new Error("TV stylesheet unavailable")), { once: true });
      }),
    ),
  );
  // Renderer 2.x draws SDF text only: every face the entry names is an
  // atlas (see src/tv-solid/sdf and fonts.ts).
  const host = await prepareBrowserRenderer();
  document.documentElement.dataset.rendererBackend = host.mode;
  const sdfReady = host.mode === "webgl" ? loadFonts(sdfFonts) : undefined;
  Config.fontSettings = { fontFamily: "Onest", fontSize: 32 };
  Config.animationsEnabled = !matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  const { render, renderer } = createRenderer(
    {
      appWidth: 1920,
      appHeight: 1080,
      deviceLogicalPixelRatio: Math.min(window.innerWidth / 1920, window.innerHeight / 1080),
      devicePhysicalPixelRatio: window.devicePixelRatio || 1,
      clearColor: 0x00000000,
      targetFPS: 60,
      textBaselineMode: "linebox",
      canvas: host.canvas,
    },
    "app",
  );
  host.canvas.style.position = "absolute";
  host.canvas.style.left = "50%";
  host.canvas.style.top = "50%";
  host.canvas.style.transform = "translate(-50%, -50%)";
  const rendererFonts = host.loadFonts ? host.loadFonts(renderer) : sdfReady;
  // @solidtv/solid 1.7 no longer registers its built-in shader types itself;
  // without them every `color`/`rounded` node draws as an unrounded quad.
  registerDefaultShaders(renderer as RendererMain);
  const rendererStartAt = performance.now();
  setRendererStart(renderer as RendererMain, rendererStartAt);
  if (new URLSearchParams(location.search).get("focusdebug") === "1") {
    const debug = window as Window & {
      __viptvRenderer?: typeof renderer;
      __viptvShaderName?: typeof tvShaderName;
      __viptvRendererStart?: () => number;
      __viptvReloadImages?: () => void;
    };
    debug.__viptvRenderer = renderer;
    debug.__viptvShaderName = tvShaderName;
    debug.__viptvRendererStart = () => rendererStartAt;
    debug.__viptvReloadImages = reloadImages;
  }
  if (new URLSearchParams(location.search).has("perfdebug"))
    (
      window as Window & {
        __viptvRendererMetrics?: () => { textureBytes: number };
      }
    ).__viptvRendererMetrics = () => ({
      textureBytes: (renderer as RendererMain).memoryInfo().memUsed,
    });
  const [[appModule]] = await Promise.all([dependencies, rendererFonts, styles]);
  if (new URLSearchParams(location.search).has("perfdebug"))
    performance.mark("viptv:deps-ready");
  const dispose = render(() =>
    createComponent(appModule.createRemoteTvApp(api, platform), {}),
  );
  const observer = new MutationObserver(reveal);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-tv-ready"],
  });
  function reveal() {
    if (document.documentElement.dataset.tvReady !== "true") return;
    observer.disconnect();
    renderer.once("frameTick", () => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("viptv:startup-ready"));
      });
    });
    (renderer as RendererMain).requestRender();
  }
  reveal();
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      dispose();
      removePs4Input();
    });
  if (new URLSearchParams(location.search).has("perfdebug"))
    performance.mark("viptv:launch-return");
}
start().catch((cause: unknown) => {
  console.error("VIPTV TV launch failed", cause);
  window.dispatchEvent(new Event("viptv:startup-failed"));
});
