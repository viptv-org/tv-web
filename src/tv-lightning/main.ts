import Blits from "@lightningjs/blits";
import "../theme/viptv-tokens.generated.css";
import { TvApi, type DeviceTokenSet } from "../api";
import { initializeCore } from "../core";
import { createLightningTvApp } from "./App";
import bricolage700Url from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2?url";
import bricolage800Url from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2?url";
import onestUrl from "@fontsource/onest/files/onest-latin-400-normal.woff2?url";
import onest600Url from "@fontsource/onest/files/onest-latin-600-normal.woff2?url";
import onest700Url from "@fontsource/onest/files/onest-latin-700-normal.woff2?url";

const platformParam = new URLSearchParams(location.search).get("platform");
const platform = platformParam === "vizio" || platformParam === "webos" ? platformParam : "tizen";
const preview = import.meta.env.DEV && import.meta.env.VITE_LAN_PREVIEW === "1";
const origin = preview ? location.origin : import.meta.env.VITE_API_ORIGIN ||
  (location.protocol === "https:" ? location.origin : "https://viptv.syek.tech");
const key = `viptv-device:${origin}`;

const api = new TvApi({
  baseUrl: origin,
  allowInsecurePreview: preview,
  sessionStore: {
    withLock: navigator.locks ? work => navigator.locks.request(key, work) : undefined,
    async load() {
      try { return JSON.parse(localStorage.getItem(key) || "null") as DeviceTokenSet | null; }
      catch { return null; }
    },
    async save(tokens) { localStorage.setItem(key, JSON.stringify(tokens)); },
    async clear() { localStorage.removeItem(key); },
  },
});

async function start() {
  await initializeCore();
  // Web-font texture creation occurs on the first Lightning render. Loading
  // the fonts first prevents static labels from keeping empty first textures
  // while later reactive labels appear after the files arrive.
  await Promise.all([
    new FontFace("Bricolage700", `url(${bricolage700Url})`).load(),
    new FontFace("Bricolage800", `url(${bricolage800Url})`).load(),
    new FontFace("Onest", `url(${onestUrl})`).load(),
    new FontFace("Onest600", `url(${onest600Url})`).load(),
    new FontFace("Onest700", `url(${onest700Url})`).load(),
  ]).then(faces => faces.forEach(face => document.fonts.add(face)));
  Blits.Launch(createLightningTvApp(api, platform), "app", {
    w: 1920,
    h: 1080,
    screenResolution: "1080p",
    renderMode: "webgl",
    holdTimeout: 700,
    fonts: [
      { family: "Bricolage700", type: "web", file: bricolage700Url },
      { family: "Bricolage800", type: "web", file: bricolage800Url },
      { family: "Onest", type: "web", file: onestUrl },
      { family: "Onest600", type: "web", file: onest600Url },
      { family: "Onest700", type: "web", file: onest700Url },
    ],
    defaultFont: "Onest",
    keymap: { 10009: "back", 461: "back", 8: "back", 27: "back" },
  });
}
start().catch((cause: unknown) => {
  document.getElementById("app")!.textContent = `VIPTV could not start: ${String(cause)}`;
});
