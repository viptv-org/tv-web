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
const origin =
  import.meta.env.VITE_API_ORIGIN ||
  (location.protocol === "https:"
    ? location.origin
    : "https://viptv.syek.tech");
const key = `viptv-device:${origin}`;
const api = new TvApi({
  baseUrl: origin,
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
createRoot(document.getElementById("root")!).render(
  <App api={api} platform={platform} />,
);
