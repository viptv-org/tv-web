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
const lanPreview = import.meta.env.DEV && import.meta.env.VITE_LAN_PREVIEW === "1";
const origin = lanPreview ? location.origin :
  import.meta.env.VITE_API_ORIGIN ||
  (location.protocol === "https:"
    ? location.origin
    : "https://viptv.syek.tech");
const key = `viptv-device:${origin}`;
const api = new TvApi({
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
const root = createRoot(document.getElementById("root")!);
initializeCore().then(() => root.render(<App api={api} platform={platform} />)).catch(() => {
  root.render(<div role="alert">viptv could not load. Please reload the app.</div>);
});
