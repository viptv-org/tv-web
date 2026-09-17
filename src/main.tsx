import { initializeCore } from "./core";
import { createRoot } from "react-dom/client";
import { TvApi, type DeviceTokenSet } from "./api";
import { App } from "./ui/App";
import type { PlayerPlatform } from "./player";
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
  const layout = platform === "tizen" || platform === "vizio" || params.get("layout") === "tv" ? "tv" : "responsive";
  root.render(<App api={api} platform={platform} layout={layout} />);
}
const root = createRoot(document.getElementById("root")!);
start().catch(() => {
  root.render(<div role="alert">viptv could not load. Please reload the app.</div>);
});
