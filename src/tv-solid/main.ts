import {
  Config,
  createRenderer,
  loadFonts,
  registerDefaultShaderRounded,
} from "@solidtv/solid";
import { createComponent } from "solid-js";
import { WebGlCoreRenderer } from "@solidtv/renderer/webgl";
import { CanvasTextRenderer } from "@solidtv/renderer/canvas";
import { installRemoteInput } from "./runtime";
import "../theme/viptv-tokens.generated.css";
import { TvApi, type DeviceTokenSet } from "../api";
import { initializeCore } from "../core";
import bricolage700Url from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2?url";
import bricolage800Url from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2?url";
import onestUrl from "@fontsource/onest/files/onest-latin-400-normal.woff2?url";
import onest500Url from "@fontsource/onest/files/onest-latin-500-normal.woff2?url";
import onest600Url from "@fontsource/onest/files/onest-latin-600-normal.woff2?url";
import onest700Url from "@fontsource/onest/files/onest-latin-700-normal.woff2?url";

const platformParam = new URLSearchParams(location.search).get("platform");
const platform =
  platformParam === "vizio" || platformParam === "webos"
    ? platformParam
    : "tizen";
const preview = import.meta.env.DEV && import.meta.env.VITE_LAN_PREVIEW === "1";
const origin = preview
  ? location.origin
  : import.meta.env.VITE_API_ORIGIN ||
    (location.protocol === "https:"
      ? location.origin
      : "https://viptv.syek.tech");
const key = `viptv-device:${origin}`;

const api = new TvApi({
  baseUrl: origin,
  allowInsecurePreview: preview,
  sessionStore: {
    withLock: navigator.locks
      ? (work) => navigator.locks.request(key, work)
      : undefined,
    async load() {
      try {
        return JSON.parse(
          localStorage.getItem(key) || "null",
        ) as DeviceTokenSet | null;
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
});

async function start() {
  if (new URLSearchParams(location.search).has("perfdebug"))
    performance.mark("viptv:init-start");
  // Web-font texture creation occurs on the first SolidTV render. Loading
  // the fonts first prevents static labels from keeping empty first textures
  // while later reactive labels appear after the files arrive. Core WASM and
  // font downloads are independent, so do both before launching the UI.
  const fontsReady = Promise.all([
    new FontFace("Bricolage700", `url(${bricolage700Url})`).load(),
    new FontFace("Bricolage800", `url(${bricolage800Url})`).load(),
    new FontFace("Onest", `url(${onestUrl})`).load(),
    new FontFace("Onest500", `url(${onest500Url})`).load(),
    new FontFace("Onest600", `url(${onest600Url})`).load(),
    new FontFace("Onest700", `url(${onest700Url})`).load(),
  ]).then((faces) => faces.forEach((face) => document.fonts.add(face)));
  // Start independent module/WASM/font work before synchronous WebGL setup.
  const dependencies = Promise.all([
    import("./App"),
    initializeCore(),
    fontsReady,
  ]);
  Config.fontSettings = { fontFamily: "Onest", fontSize: 32 };
  Config.animationsEnabled = false;
  const { render, renderer } = createRenderer(
    {
      appWidth: 1920,
      appHeight: 1080,
      deviceLogicalPixelRatio: window.innerWidth / 1920,
      devicePhysicalPixelRatio: window.devicePixelRatio || 1,
      renderEngine: WebGlCoreRenderer,
      fontEngines: [CanvasTextRenderer],
      clearColor: 0x00000000,
      textBaselineMode: "linebox",
    },
    "app",
  );
  registerDefaultShaderRounded(renderer.stage.shManager);
  if (new URLSearchParams(location.search).get("focusdebug") === "1")
    (window as Window & { __viptvRenderer?: typeof renderer }).__viptvRenderer = renderer;
  const rendererFonts = loadFonts(
    [
      { fontFamily: "Bricolage700", fontUrl: bricolage700Url },
      { fontFamily: "Bricolage800", fontUrl: bricolage800Url },
      { fontFamily: "Onest", fontUrl: onestUrl },
      { fontFamily: "Onest500", fontUrl: onest500Url },
      { fontFamily: "Onest600", fontUrl: onest600Url },
      { fontFamily: "Onest700", fontUrl: onest700Url },
    ].map((font) => ({
      ...font,
      metrics: { ascender: 800, descender: -200, lineGap: 0, unitsPerEm: 1000 },
    })),
  );
  const [[appModule]] = await Promise.all([dependencies, rendererFonts]);
  if (new URLSearchParams(location.search).has("perfdebug"))
    performance.mark("viptv:deps-ready");
  const disposeInput = installRemoteInput();
  const dispose = render(() =>
    createComponent(appModule.createSolidTvApp(api, platform), {}),
  );
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      disposeInput();
      dispose();
    });
  if (new URLSearchParams(location.search).has("perfdebug"))
    performance.mark("viptv:launch-return");
}
start().catch((cause: unknown) => {
  document.getElementById("app")!.textContent =
    `VIPTV could not start: ${String(cause)}`;
});
