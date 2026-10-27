import { Config, createRenderer, loadFonts } from "@solidtv/solid";
import { createComponent } from "solid-js";
import { WebGlCoreRenderer } from "@solidtv/renderer/webgl";
import { CanvasTextRenderer } from "@solidtv/renderer/canvas";
import {
  displayFonts,
  configureDisplayFonts,
  canvasFontMetrics,
} from "./fonts";
import { tvRoundedShader } from "./rounded-shader";
import "../theme/viptv-tokens.generated.css";

import { RemoteTvApi } from "./remote/api";
import type { Tokens } from "./remote/types";

import bricolage700Url from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2?url";
import bricolage800Url from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2?url";
import onestUrl from "@fontsource/onest/files/onest-latin-400-normal.woff2?url";
import onest500Url from "@fontsource/onest/files/onest-latin-500-normal.woff2?url";
import onest600Url from "@fontsource/onest/files/onest-latin-600-normal.woff2?url";
import onest700Url from "@fontsource/onest/files/onest-latin-700-normal.woff2?url";

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
  {
    withLock: navigator.locks
      ? (work) => navigator.locks.request(key, work)
      : undefined,
    async load() {
      try {
        return JSON.parse(localStorage.getItem(key) || "null") as Tokens | null;
      } catch {
        return null;
      }
    },
    async save(tokens) {
      localStorage.setItem(key, JSON.stringify(tokens));
    },
    async clear() {
      localStorage.removeItem(key);
    },
  },
  undefined,
  platform,
);

async function start() {
  if (new URLSearchParams(location.search).has("perfdebug"))
    performance.mark("viptv:init-start");
  // Prefetch each face once through SolidTV before synchronous WebGL setup.
  // The renderer attaches the prefetched faces when its stage is available.
  const dependencies = Promise.all([import("./remote/App")]);
  const rendererFonts = loadFonts(
    [
      { fontFamily: "Bricolage700", fontUrl: bricolage700Url },
      { fontFamily: "Bricolage800", fontUrl: bricolage800Url },
      { fontFamily: "Onest", fontUrl: onestUrl },
      { fontFamily: "Onest500", fontUrl: onest500Url },
      { fontFamily: "Onest600", fontUrl: onest600Url },
      { fontFamily: "Onest700", fontUrl: onest700Url },
      { fontFamily: "Onest700Tabular", fontUrl: onest700Url },
      ...displayFonts.filter(({ fontFamily }) =>
        /^Bricolage800Optical(?:17|28|32|48|50|52|55|56|80|90|92|104)$/.test(
          fontFamily,
        ),
      ),
    ].map((font) => ({
      ...font,
      metrics: canvasFontMetrics(font.fontFamily),
    })),
  );
  Config.fontSettings = { fontFamily: "Onest", fontSize: 32 };
  Config.animationsEnabled = !matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  const { render, renderer } = createRenderer(
    {
      appWidth: 1920,
      appHeight: 1080,
      deviceLogicalPixelRatio: window.innerWidth / 1920,
      devicePhysicalPixelRatio: window.devicePixelRatio || 1,
      renderEngine: WebGlCoreRenderer,
      fontEngines: [CanvasTextRenderer],
      clearColor: 0x00000000,
      textureMemory: {
        criticalThreshold: 64 * 1024 * 1024,
        targetThresholdLevel: 0.65,
        cleanupInterval: 2000,
      },
      textBaselineMode: "linebox",
    },
    "app",
  );
  renderer.stage.shManager.registerShaderType("rounded", tvRoundedShader);
  if (new URLSearchParams(location.search).get("focusdebug") === "1")
    (window as Window & { __viptvRenderer?: typeof renderer }).__viptvRenderer =
      renderer;
  if (new URLSearchParams(location.search).has("perfdebug"))
    (
      window as Window & {
        __viptvRendererMetrics?: () => { textureBytes: number };
      }
    ).__viptvRendererMetrics = () => ({
      textureBytes:
        "txMemManager" in renderer.stage
          ? renderer.stage.txMemManager.getMemoryInfo().memUsed
          : 0,
    });
  const [[appModule]] = await Promise.all([dependencies, rendererFonts]);
  configureDisplayFonts();
  if (new URLSearchParams(location.search).has("perfdebug"))
    performance.mark("viptv:deps-ready");
  const dispose = render(() =>
    createComponent(appModule.createRemoteTvApp(api, platform), {}),
  );
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      dispose();
    });
  if (new URLSearchParams(location.search).has("perfdebug"))
    performance.mark("viptv:launch-return");
}
start().catch((cause: unknown) => {
  console.error("VIPTV TV launch failed", cause);
  document.getElementById("app")!.textContent =
    `VIPTV could not start: ${String(cause)}`;
});
