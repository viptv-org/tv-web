// Stylesheet order: generated tokens → bundled fonts → styles/index.css (reset
// floor) → legacy CSS (imported by the UI modules) → styles/design.css
// (primitives + screen families, below, so they win at equal specificity).
import "./theme/viptv-tokens.generated.css";
import "./theme/fonts";
import "./styles/index.css";
import { initAppearance } from "./theme/appearance";
import { initializeCore } from "./core";
import { createRoot } from "react-dom/client";
import { TvApi, type DeviceTokenSet } from "./api";
import { App } from "./ui/App";
import { LocalApp } from "./ui/LocalApp";
import { localModeAvailable, readLocalMode } from "./local";
// Design-system layers load after every legacy stylesheet (imported by App/LocalApp above).
import "./styles/design.css";
import type { PlayerPlatform } from "@viptv/video";
const params = new URLSearchParams(location.search);
const native = "__TAURI_INTERNALS__" in window;
// The desktop shell runs the shared responsive UI on the native engine; an
// explicit ?platform= param still selects a TV engine for manual testing.
const platform: PlayerPlatform =
  params.get("platform") === "tizen"
    ? "tizen"
    : params.get("platform") === "vizio"
      ? "vizio"
      : native
        ? "tauri"
        : "html5";
const lanPreview = import.meta.env.DEV && import.meta.env.VITE_LAN_PREVIEW === "1";
const origin = lanPreview ? location.origin :
  import.meta.env.VITE_API_ORIGIN ||
  (!native && location.protocol === "https:"
    ? location.origin
    : native && import.meta.env.DEV
      ? "https://viptv.local.test:8443"
      : "https://viptv.syek.tech");
const key = `viptv-device:${origin}`;
async function start() {
  const nativeFetch = native ? (await import("@tauri-apps/plugin-http")).fetch : undefined;
  const api = new TvApi({
    fetch: nativeFetch ? (input, init) => {
      // The HTTP plugin would pin Origin to this window's origin (the vite dev
      // server here), which the backend's single-browser-origin pin rejects.
      // Present the desktop app as a first-party client of its API origin,
      // exactly like the served web app whose browser Origin matches the pin.
      const headers = new Headers(init?.headers);
      headers.set("Origin", origin);
      return nativeFetch(input, { ...init, headers, maxRedirections: 0 });
    } : undefined,
    baseUrl: origin,
    allowInsecurePreview: lanPreview,
    sessionStore: {
      withLock: navigator.locks ? work => navigator.locks.request(key, work) : undefined,
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
  await initializeCore();
  if (import.meta.env.DEV) {
    void import("./testing/fps-harness").then(({ initFpsHarness }) => initFpsHarness());
  }
  if (import.meta.env.PROD) {
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  const layout = platform === "tizen" || platform === "vizio" || params.get("layout") === "tv" ? "tv" : "responsive";
  // Root hooks for platform-scoped CSS: data-layout="tv|responsive",
  // data-platform="tizen|vizio|tauri|html5".
  document.documentElement.setAttribute("data-layout", layout);
  document.documentElement.setAttribute("data-platform", platform);
  // Local addon mode is a boot-level branch (LM-001): the flag is honored
  // only when the build declares the capability.
  if (localModeAvailable && readLocalMode()) {
    root.render(<LocalApp onExit={() => location.reload()} fetch={nativeFetch ?? undefined} />);
    return;
  }
  root.render(<App api={api} platform={platform} layout={layout} />);
}
// Device appearance (<html data-oled / data-accent>) before the first paint.
initAppearance();
const root = createRoot(document.getElementById("root")!);
// TV/embedded-browser diagnosis opt-in: with ?reportboot=1 the page reports
// boot and render failures to its own origin (/boot-error/...) so a harness
// can read them from the serving access log. Silent no-op in production.
if (params.get("reportboot")) {
  const report = (detail: unknown) => {
    void fetch(`/boot-error/${encodeURIComponent(String(detail).slice(0, 300))}`).catch(() => undefined);
  };
  window.addEventListener("error", event =>
    report(`${event.message} @ ${(event.filename ?? "").split("/").pop()}:${event.lineno}`));
  window.addEventListener("unhandledrejection", event => report(event.reason));
}
// DEV-only component gallery (?gallery=phone|desktop|tv[&sheet=CmpPhone1]): the
// design-system primitives laid out like the reference component sheets.
if (import.meta.env.DEV && params.get("gallery")) {
  void import("./ui/primitives/gallery/Gallery").then(({ mountGallery }) => mountGallery(root, params));
} else start().catch((error: unknown) => {
  if (params.get("reportboot")) {
    void fetch(`/boot-error/start/${encodeURIComponent(String((error as Error)?.message ?? error).slice(0, 300))}`).catch(() => undefined);
  }
  root.render(<div role="alert">viptv could not load. Please reload the app.</div>);
});
