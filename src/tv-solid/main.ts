import "./platform/tv-compat";
import { Config } from "@solidtv/solid";
import { createComponent } from "solid-js";
import type { RendererMain } from "@solidtv/renderer";
import { tvShaderName } from "./shaders";
import { setRendererStart } from "./renderer-clock";
import { configureImageApiOrigin, reloadImages } from "./remote/image-source";
import { prepareTizenHost } from "./platform/tizen-host";
import { startBrowserRenderer } from "./platform/renderer-startup";
import { installPs4Input } from "./platform/ps4-input";
import { resolveTvPlatform } from "./platform/tv-platform";
import { packagedTvHost, tvApiOrigin } from "./platform/packaged-host";
import "../theme/viptv-tokens.generated.css";

import { RemoteTvApi } from "./remote/api";
import { createBrowserSessionStore } from "./platform/browser-session-store";

document.documentElement.dataset.renderer = "solid";
const packageHost = packagedTvHost();
const platform = packageHost?.platform ?? resolveTvPlatform(location.search, navigator.userAgent);
document.documentElement.dataset.tvPlatform = platform;
const origin = tvApiOrigin();
configureImageApiOrigin(origin);
const key = `viptv-device:${origin}`;

const api = new RemoteTvApi(
  origin,
  createBrowserSessionStore(key, () => localStorage, navigator.locks),
  undefined,
  platform,
);

async function start() {
  const removePs4Input = installPs4Input();
  if (new URLSearchParams(location.search).has("perfdebug")) performance.mark("viptv:init-start");
  const dependencies = Promise.all([import("./remote/App"), prepareTizenHost(platform)]);
  const styles = Promise.all(
    Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][media="print"]'),
    ).map((link) =>
      link.sheet
        ? Promise.resolve()
        : new Promise<void>((resolve, reject) => {
            link.addEventListener("load", () => resolve(), { once: true });
            link.addEventListener("error", () => reject(new Error("TV stylesheet unavailable")), {
              once: true,
            });
          }),
    ),
  );
  Config.fontSettings = { fontFamily: "Onest", fontSize: 32 };
  Config.animationsEnabled = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  await startBrowserRenderer({
    settings: {
      appWidth: 1920,
      appHeight: 1080,
      deviceLogicalPixelRatio: Math.min(window.innerWidth / 1920, window.innerHeight / 1080),
      devicePhysicalPixelRatio: window.devicePixelRatio || 1,
      clearColor: 0x00000000,
      targetFPS: 60,
      textBaselineMode: "linebox",
    },
    target: "app",
    ready: Promise.all([dependencies, styles]),
    onRenderer: ({ renderer, host }) => {
      document.documentElement.dataset.rendererBackend = host.mode;
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
    },
    mount: ({ renderer, render, host }, [[appModule]]) => {
      if (new URLSearchParams(location.search).has("perfdebug"))
        performance.mark("viptv:deps-ready");
      const dispose = render(() => createComponent(appModule.createRemoteTvApp(api, platform), {}));
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
          observer.disconnect();
          dispose();
          removePs4Input();
          host.dispose(renderer);
          host.canvas.remove();
        });
      if (new URLSearchParams(location.search).has("perfdebug"))
        performance.mark("viptv:launch-return");
    },
  }).catch((error: unknown) => {
    removePs4Input();
    throw error;
  });
}
start().catch((cause: unknown) => {
  console.error("VIPTV TV launch failed", cause);
  window.dispatchEvent(new Event("viptv:startup-failed"));
});
