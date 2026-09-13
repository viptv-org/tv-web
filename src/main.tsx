import { initializeCore } from "./core";
import React from "react";
import { createRoot } from "react-dom/client";
import { TvApi, type DeviceTokenSet } from "./api";
import { App } from "./ui/App";
import type { PlayerPlatform } from "./player";
const params = new URLSearchParams(location.search);
const platform: PlayerPlatform =
  params.get("platform") === "tizen"
    ? "tizen"
    : params.get("platform") === "vizio"
      ? "vizio"
      : "html5";
const native = "__TAURI_INTERNALS__" in window;
const lanPreview = import.meta.env.DEV && import.meta.env.VITE_LAN_PREVIEW === "1";
const origin = lanPreview ? location.origin :
  import.meta.env.VITE_API_ORIGIN ||
  (!native && location.protocol === "https:"
    ? location.origin
    : "https://viptv.syek.tech");
const key = `viptv-device:${origin}`;
async function start() {
  const nativeFetch = native ? (await import("@tauri-apps/plugin-http")).fetch : undefined;
  const api = new TvApi({
    fetch: nativeFetch ? (input, init) => nativeFetch(input, { ...init, maxRedirections: 0 }) : undefined,
    baseUrl: origin,
    allowInsecurePreview: lanPreview,
    sessionStore: {
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
  const layout = platform !== "html5" || params.get("layout") === "tv" ? "tv" : "responsive";
  root.render(<App api={api} platform={platform} layout={layout} />);
}
const root = createRoot(document.getElementById("root")!);
start().catch(() => {
  root.render(<div role="alert">viptv could not load. Please reload the app.</div>);
});
